// disqus-migrate.js path-to-md-files
// e.g. node disqus-migrate.js d:\gitwork\hugo.conoroneill.net\content\post
// Will output "old, new" CSV i.e. /slug to /yyyy/mm/dd/slug and http to https

const path = require("path");
const fs = require("fs");
const matter = require("gray-matter");
const toml = require("toml");

var args = process.argv.slice(2);

fs.readdir(args[0], function (err, files) {
    if (err) {
        return console.log("Unable to scan directory: " + err);
    }
    files.forEach(function (file) {
        console.log(file);
        var data = fs.readFileSync(args[0] + "\\" + file);
        var md = matter(data, {
            delims: ["+++", "+++"],
            engines: {
                toml: toml.parse.bind(toml)
            },
            language: "toml"
        });

        var d = new Date(md.data.date);
        var month = "" + (d.getMonth() + 1);
        var day = "" + d.getDate();
        var year = d.getFullYear();
        if (month.length < 2) month = "0" + month;
        if (day.length < 2) day = "0" + day;

        if (md.data.slug == null) {
            md.data.slug = slugify(md.data.title.toLowerCase());
        }

        var oldURL = "http://conoroneill.net/" + md.data.slug + "/";
        var newURL = "https://conoroneill.net/" + year + "/" + month + "/" + day + "/" + md.data.slug + "/";
        var line = oldURL + ", " + newURL + "\n";
        console.log(oldURL, newURL);

        fs.appendFileSync(__dirname + "\\disqus_mapping.csv", line);
    });
});