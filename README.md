# Johyun Park's blog

Notes and studies on AI, Bio, and Chem, published at https://jstring17.github.io.

Built with Zola and a local copy of the Serenity theme in `themes/serenity`.
Theme changes are committed together with the blog.

Theme source: https://github.com/Smileyhojin/serenity
Imported from commit `855fb2322ffee598523b19422798dce10a221d41`.
The original theme and third-party licenses are preserved in the theme directory,
and the original Git history is kept.

## Develop

Install Zola 0.23.6 or newer, or use the pinned Nix development environment.
The theme is included; no submodule setup is needed.

```sh
# nix develop
zola check --drafts --skip-external-links
zola build
zola serve --drafts --base-url /
```

## Writing

The home page lists posts from `content/blog/`. Create each post as
`content/blog/my-post/index.md` and put images or scripts beside it.
Give each post one or two fields and one type, field first (case-sensitive):

```toml
+++
title = "My first post"
date = 2026-11-12
draft = true

[taxonomies]
tags = ["AI", "Paper"] # 1-2 of AI, Bio, Chem + 1 of Landscape, Paper, Company
+++
```

Set `draft = false` when ready to publish; drafts appear only with `zola serve --drafts`.
The Writing Guideline stays a draft and is not published.
Tag links filter the home list, and the header's theme button saves the
light/dark preference in this browser.

## Deploy

Pushing to `main` runs `.github/workflows/pages.yml`. It checks the site with drafts,
builds it without drafts, and deploys `public/` to GitHub Pages.
