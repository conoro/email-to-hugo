// email-to-hugo - Copyright Conor O'Neill 2018, conor@conoroneill.com
// LICENSE Apache-2.0

module.exports.check = (event, context, callback) => {

    var fs = require("fs");

    var Imap = require("imap");
    var base64 = require("base64-stream");
    var slugify = require('slugify');
    var mkdirp = require('mkdirp');
    const simpleParser = require('mailparser').simpleParser;
    const octokit = require('@octokit/rest')();
    var addrs = require("email-addresses");

    var TurndownService = require('turndown');

    var turndownService = new TurndownService()

    var imap = new Imap({
        user: process.env.EMAIL2HUGO_IMAP_USER,
        password: process.env.EMAIL2HUGO_IMAP_PASSWORD,
        host: process.env.EMAIL2HUGO_IMAP_HOST,
        port: process.env.EMAIL2HUGO_IMAP_PORT,
        tls: process.env.EMAIL2HUGO_IMAP_TLS
    });

    octokit.authenticate({
        type: process.env.EMAIL2HUGO_OCTO_AUTH_TYPE,
        token: process.env.EMAIL2HUGO_OCTO_AUTH_TOKEN
    });

    var senderWhitelist = process.env.EMAIL2HUGO_WHITELIST.split(',').map(item => item.trim());

    var postdir;
    var imgdir;
    var blogposts = [];

    function toUpper(thing) {
        return thing && thing.toUpperCase ? thing.toUpperCase() : thing;
    }

    function findAttachmentParts(struct, attachments) {
        attachments = attachments || [];
        for (var i = 0, len = struct.length, r; i < len; ++i) {
            if (Array.isArray(struct[i])) {
                findAttachmentParts(struct[i], attachments);
            } else {
                if (
                    struct[i].disposition && ["INLINE", "ATTACHMENT"].indexOf(toUpper(struct[i].disposition.type)) >
                    -1
                ) {
                    attachments.push(struct[i]);
                }
            }
        }
        return attachments;
    }

    function buildAttMessageFunction(attachment) {
        var filename = attachment.params.name;
        var encoding = attachment.encoding;

        return function (msg, seqno) {
            var prefix = "(#" + seqno + ") ";
            msg.on("body", function (stream, info) {
                //Create a write stream so that we can stream the attachment to file;
                // console.log(prefix + "Streaming this attachment to file", slugify(filename.toLowerCase()), info);
                var writeStream = fs.createWriteStream("/tmp/" + imgdir + "/" + slugify(filename.toLowerCase()));
                writeStream.on("finish", async function () {
                    var image = fs.readFileSync("/tmp/" + imgdir + "/" + slugify(filename.toLowerCase()));
                    content = image.toString('base64');

                    // Save to array and upload everything at the end
                    var imagePost = {};
                    imagePost.path = imgdir + "/" + slugify(filename.toLowerCase());
                    imagePost.content = content;
                    imagePost.message = slugify(filename.toLowerCase());
                    blogposts.push(imagePost);
                });
                if (toUpper(encoding) === "BASE64") {
                    //the stream is base64 encoded, so here the stream is decode on the fly and piped to the write stream (file)
                    stream.pipe(base64.decode()).pipe(writeStream);
                } else {
                    //here we have none or some other decoding streamed directly to the file which renders it useless probably
                    stream.pipe(writeStream);
                }
            });
            msg.once("end", function () {
                // console.log(prefix + "Finished attachment %s", imgdir + "/" + slugify(filename.toLowerCase()));
            });
        };
    }

    async function openInbox(cb) {
        // 2nd param false means read-write access to INBOX
        imap.openBox("INBOX", false, cb);
    }

    var d = new Date();
    var month = '' + (d.getMonth() + 1);
    var day = '' + d.getDate();
    var year = d.getFullYear();

    imap.once("ready", function () {
        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        postdir = "content/post";
        imgdir = "static/images/" + year + "/" + month + "/" + day;

        mkdirp.sync("/tmp/" + postdir, function (err) {
            if (err) console.error(err)
            else console.log('Error creating ' + postdir)
        });

        mkdirp.sync("/tmp/" + imgdir, function (err) {
            if (err) console.error(err)
            else console.log('Error creating ' + imgdir)
        });

        openInbox(function (err, box) {
            if (err) throw err;
            imap.search(['UNSEEN'], function (err, results) {
                // console.log(results);
                if (results.length != 0) {
                    var f = imap.fetch(results, {
                        bodies: [''],
                        struct: true,
                        markSeen: true
                    });
                    f.on('message', function (msg, seqno) {
                        console.log('Message #%d', seqno);
                        var blogpost = {};
                        blogpost.validSender = true;

                        msg.on('body', function (stream, info) {
                            var buffer = "";
                            stream.on("data", function (chunk) {
                                buffer += chunk.toString("utf8");
                            });
                            stream.once("end", function () {
                                var parsedHeader = Imap.parseHeader(buffer);
                                // console.log('Parsed header: %s', parsedHeader);
                                var fromEmail = addrs.parseOneAddress(parsedHeader.from[0]).address;
                                if (senderWhitelist.includes(fromEmail.toLowerCase()) == false) {
                                    // Discard
                                    blogpost.validSender = false;
                                    console.log("Email rejected. Bad sender");
                                }
                                // console.log("From: " + addrs.parseOneAddress(parsedHeader.from[0]).address);
                            });
                            simpleParser(stream)
                                .then(parsed => {
                                    if (blogpost.validSender == true) {
                                        var markdownHeader = "+++\n";
                                        markdownHeader = markdownHeader + "date = \"" + d.toISOString() + "\"\n";
                                        markdownHeader = markdownHeader + "draft = false\n";
                                        markdownHeader = markdownHeader + "title = \"" + parsed.subject + "\"\n";
                                        markdownHeader = markdownHeader + "slug = \"" + slugify(parsed.subject.toLowerCase()) + "\"\n";
                                        markdownHeader = markdownHeader + "+++\n\n";

                                        // Replace base64 inline images with external references and slugify image filenames to avoid ones with spaces in the names
                                        var content = turndownService.turndown(parsed.html);
                                        const regex = /\[(.*)\]\(data:image(.*)\)/g;
                                        const fixedImages = content.replace(regex, function (match, p1, p2) {
                                            return ("[" + p1 + "](/images/" + year + "/" + month + "/" + day + "/" + slugify(p1.toLowerCase()) + ")");
                                        });

                                        // Re-unescape markdown headers so I can use #, ## and ### in emails (note use of multiline mode)
                                        const regexUnescape = /^\\#/gm;
                                        const fixedContent = fixedImages.replace(regexUnescape, '#');

                                        var markdown = markdownHeader + fixedContent;
                                        // console.log(parsed.textAsHtml);
                                        // console.log(markdown);

                                        var outfile = "/tmp/" + postdir + "/" + slugify(parsed.subject.toLowerCase()) + ".md";
                                        fs.writeFileSync(outfile, markdown, function (err) {
                                            if (err) throw err;
                                            console.log('Saved!');
                                        });

                                        // Save to array and upload everything at the end
                                        content = Buffer.from(markdown).toString('base64');
                                        blogpost.path = postdir + "/" + slugify(parsed.subject.toLowerCase()) + ".md";
                                        blogpost.content = content;
                                        blogpost.message = parsed.subject;
                                        blogposts.push(blogpost);
                                    }
                                })
                                .catch(err => {
                                    console.log(err);
                                });
                        });

                        msg.once("attributes", function (attrs) {
                            // Is this the right place for this??
                            if (blogpost.validSender == true) {
                                // console.log("Attributes: %d", attrs);
                                var attachments = findAttachmentParts(attrs.struct);
                                // console.log("Has attachments: %d", attachments.length);
                                for (var i = 0, len = attachments.length; i < len; ++i) {
                                    var attachment = attachments[i];
                                    // console.log(
                                    //     "Fetching attachment %s",
                                    //     attachment.params.name
                                    // );
                                    var f = imap.fetch(attrs.uid, {
                                        bodies: [attachment.partID],
                                        struct: true
                                    });
                                    //build function to process attachment message
                                    f.on("message", buildAttMessageFunction(attachment));
                                }
                            }
                        });
                        msg.once("end", function () {
                            console.log("Finished email");
                        });
                    });
                    f.once("error", function (err) {
                        console.log("Fetch error: " + err);
                    });
                    f.once("end", function () {
                        console.log("Done fetching all messages");
                        imap.end();
                    });
                } else {
                    console.log("No new emails");
                    imap.end();
                }
            });
        });
    });


    imap.once("error", function (err) {
        console.log(err);
        callback(null, {
            statusCode: error.statusCode || 501,
            headers: {
                "Content-Type": "text/plain"
            },
            body: gerr
        });
        return;
    });

    imap.once("end", function () {
        uploadAllToGitHub();
    });

    imap.connect();


    async function uploadAllToGitHub(path, content, message) {
        // console.log("Uploading to GitHub");

        for (var i = 0; i < blogposts.length; i++) {
            try {
                console.log("Uploading to GitHub: " + blogposts[i].path);
                await octokit.repos.createFile({
                    owner: process.env.EMAIL2HUGO_OCTO_OWNER,
                    repo: process.env.EMAIL2HUGO_OCTO_REPO,
                    path: blogposts[i].path,
                    message: blogposts[i].message,
                    content: blogposts[i].content
                });
            } catch (err) {
                if (err.code == 409 || err.code == 422) {
                    console.log("Error back from GH. File probably already exists there.");
                    // console.log(err);
                } else {
                    console.log(err);
                    callback(null, {
                        statusCode: error.statusCode || 501,
                        headers: {
                            "Content-Type": "text/plain"
                        },
                        body: err
                    });
                    return;
                }
            }
            // await sleep(1000);
        }
        console.log("All actions done");
        // create a response
        const response = {
            statusCode: 200,
            body: "Successful"
        };
        callback(null, response);
    }

    function sleep(millis) {
        return new Promise(resolve => setTimeout(resolve, millis));
    }

};