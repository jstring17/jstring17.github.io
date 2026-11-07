# Johyun Park's blog

Built with Zola and a local copy of the Serenity theme in `themes/serenity`.
Theme changes are committed together with the blog.

Theme source: https://github.com/Smileyhojin/serenity
Imported from commit `855fb2322ffee598523b19422798dce10a221d41`.
The original theme and third-party licenses are preserved in the theme directory.

## Develop

```sh
# nix develop
zola check --drafts --skip-external-links
zola build
zola serve --drafts --base-url /
```

## Writing

The home page lists posts from `content/blog/`. Create each post as
`content/blog/my-post/index.md` and put images or scripts beside it.
Use one or more of the four tags (case-sensitive):

```toml
+++
title = "My first post"
date = 2026-11-07
draft = true

[taxonomies]
tags = ["AI", "Research"] # AI, Bio, Market, Research
+++
```

Set `draft = false` when ready to publish. Preview with `zola serve --drafts`.
The existing Writing Guideline remains a draft and is not published.
The name header links home; tag links filter the home list, and the header's
theme button saves the light/dark preference in this browser.

Original Git history and theme attribution are preserved. Current site identity
and production URLs are configured for Johyun Park at https://johyun.github.io.
