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
- You'll need to create a dedicated GMail account per blog to receive the posts and create a GitHub OAuth App
- It assumes you are building your Hugo site via some sort of CI like CircleCI. It does not run Hugo in any way.
- There is a simple whitelisting feature so that admin/spam/accidental emails to your account don't get converted to blogposts

## Installing and using

```bash
git clone
```

LICENSE Apache-2.0

Copyright Conor O'Neill 2018, conor@conoroneill.com
