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

## Continue on another computer

The private repository is https://github.com/jstring17/johyun.github.io.
Authenticate to GitHub with an account that has access, then run:

```sh
git clone https://github.com/jstring17/johyun.github.io.git
cd johyun.github.io
git switch customize-blog
```

Install Zola 0.23.6 or newer (or use the pinned Nix development environment), then:

```sh
zola serve --drafts --interface 127.0.0.1 --port 1112
```

Open http://127.0.0.1:1112/. The theme is included; no submodule setup is needed.
Read `AGENTS.md` before editing. Before starting work, run `git pull --ff-only`.
Commit and `git push` before switching computers. Each computer needs its own GitHub
authentication and Git author configuration; these are not copied by cloning.

`customize-blog` is the default working branch. `main` and `before-customization`
preserve the original baseline. GitHub Actions is disabled for code-only synchronization.
No site has been deployed. Before enabling deployment, choose the actual Pages URL:
the GitHub account is `jstring17`, while `base_url` currently uses `johyun.github.io`.
