// change-hugo-permalinks.js path-to-md-files 
// e.g. node change-hugo-permalinks.js d:\gitwork\hugo.conoroneill.net\content\post
// Will change from /slug to /yyyy/mm/dd/slug

const path = require("path");
const fs = require("fs");
const matter = require('gray-matter');
const toml = require('toml');
var slugify = require('slugify');

var args = process.argv.slice(2);

fs.readdir(args[0], function (err, files) {
    if (err) {
        return console.log("Unable to scan directory: " + err);
    }
    files.forEach(function (file) {
        console.log(file);
        var data = fs.readFileSync(args[0] + "\\" + file);
        var md = matter(data, {
            delims: ['+++', '+++'],
            engines: {
                toml: toml.parse.bind(toml),
            },
            language: 'toml'
        });

        var d = new Date(md.data.date);
        var month = '' + (d.getMonth() + 1);
        var day = '' + d.getDate();
        var year = d.getFullYear();
        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        if (md.data.slug == null) {
            md.data.slug = slugify(md.data.title.toLowerCase());
        }

        var oldSlug = "/" + md.data.slug + "/";
        var newSlug = "/" + year + "/" + month + "/" + day + "/" + md.data.slug;

        var aliases = [
            oldSlug,
            newSlug
        ];

        md.data.aliases = aliases;
        if (md.data.description == null) {
            md.data.description = " ";
        }

        outputString =
            "+++\n" +
            "aliases = " + JSON.stringify(md.data.aliases) + "\n" +
            "date = \"" + md.data.date + "\"\n" +
            "draft = false\n" +
            "title = \"" + md.data.title + "\"\n" +
            "description = \"" + md.data.description + "\"\n" +
            "slug = \"" + md.data.slug + "\"\n" +
            "+++\n" +
            md.content;

        //console.log(outputString);
        fs.writeFileSync(__dirname + "\\temp\\" + file, outputString);

    });
});