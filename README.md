# Email to Hugo

email-to-hugo checks an email account via IMAP every 15 minutes and converts new emails to Hugo blogposts which it then uploads to your Hugo source GitHub repo along with any inline images.

It runs as a Serverless function on AWS Lambda every 15 minutes (or when you manually call its URL).

## Notes

- Overall it is likely to be very brittle and has only been tested on GMail.
- It has configurable IMAP and GitHub settings but the Hugo path settings are currently hardcoded
- It doesn't handle attached images in GMail, only inline ones
- It allows use of # ## and ### for h1, h2 and h3 in your emails
- Basic GMail formatting like bold/italic/underline is preserved. Font and font-size are not.
- It adds basic metadata like title/date/slug/draft-status to each post
- It assumes you are building your Hugo site via some sort of CI like CircleCI. It does not run Hugo in any way. So it can be used from any device with an email client.
- There is a simple whitelisting feature so that admin/spam/accidental emails to your account don't get converted to blogposts

## Installing and using

1. Install Node.js
2. Make sure you have your AWS credentials setup correctly
3. Install and configure [Serverless](https://serverless.com/framework/docs/getting-started/)
4. Create a dedicated GMail account to receive the emails for one blog
5. Create a GitHub Personal Access Token at https://github.com/settings/tokens
6. Make sure your Hugo blog is successfully building and deploying via CircleCI etc. See [my config here](https://github.com/conoro/hugo.conoroneill.com/blob/master/circle.yml) for one of my blogs.

7. Then:

```bash
git clone https://github.com/conoro/email-to-hugo.git
cd email-to-hugo
npm install
cp email2hugo-sample.env.yml email2hugo.env.yml
```

8. Edit email2hugo.env.yml and enter all your configuration settings.
9. Deploy with `serverless deploy`

From then on, it will check every 15 mins (you can change this in serverless.yml) or by accessing the URL returned by serverless deploy.

## Other utilities

- change-hugo-permalinks.js - Bulk changes the slug structure in TOML metadata in all your Hugo posts from /slug to /yyyy/mm/dd/slug.
- disqus-migrate.js - Generates Disqus migration CSV file with list of /slug,/yyyy/mm/dd/slug URLs. Note this is hardcoded

LICENSE Apache-2.0

Copyright Conor O'Neill 2018, conor@conoroneill.com
