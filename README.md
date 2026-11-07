# Smileyhojin's blog

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
