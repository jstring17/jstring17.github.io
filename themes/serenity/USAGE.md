# Serenity usage

Requires Zola 0.23.6 or later. Run commands from your site directory.

## Set up the site

```sh
zola init myblog
cd myblog
git init
# Replace the placeholder with your theme repository URL.
git submodule add <theme-repository-url> themes/serenity
cp themes/serenity/zola.toml.example zola.toml
```

In `zola.toml`, edit `base_url`, `title`, `description`, and the profile and links
under `[extra]`. Keep `theme = "serenity"`. Use `extra.nav` for navigation and
`extra.links` for social links; icon names include `linkedin`, `github`, and `email`.

Create these two files:

**`content/_index.md`**

```toml
+++
template = "home.html"
[extra]
recent = true          # Show recent blog entries
recent_max = 5
recent_more_text = "more »"
footer = false
+++
Your introduction goes here.
```

**`content/blog/_index.md`**

```toml
+++
title = "Blog"
sort_by = "date"
template = "blog.html"
page_template = "post.html"
insert_anchor_links = "right"
[extra]
title = "Blog"
categorized = false
back_to_top = true
+++
```

If you rename `blog/`, update `extra.blog_section_path` and the navigation path
in `zola.toml` too. For an optional About section, use `template = "prose.html"`
in `content/about/_index.md` and add `/about` to navigation.

## Write a post

Create `content/blog/my-post/index.md`. Keep its images and chart scripts beside it.

```toml
+++
title = "My post"
description = "A short summary"
date = 2026-10-11              # Required for date-sorted lists
# updated = 2026-10-12
draft = true                  # Set false to publish
# aliases = ["/old-address/"] # Redirect an old URL
# in_search_index = false
[taxonomies]
tags = ["writing"]
categories = ["Notes"]
[extra]
toc = true
code_copy = true
math = false                  # Enable for formulas
mermaid = false               # Enable for diagrams
featured = false              # Mark the title with an asterisk
outdated_alert = false
outdated_alert_days = 120
# og_image = "cover.webp"     # Sharing image beside this file
+++
Your Markdown goes here.
```

Set shared display options in the site's `[extra]`; override them in a section
or post as needed. To group the Blog list by category, set `categorized = true`
in its section and assign every post a category. Browse all tags at `/tags/`
and categories at `/categories/`.

```sh
zola serve --drafts                    # Preview, including drafts
zola check --drafts --skip-external-links
zola build                            # Build published content into public/
```

Deploy `public/`. Ignore `public/` and `/static/processed_images/` in Git.

## Add content

Use standard Markdown for text, lists, tables, links, images, and footnotes.
These examples go in the post body.

### Code

````markdown
```rust,linenos,linenostart=93,hl_lines=2-3,name=src/main.rs
fn main() {
    let name = "Serenity";
    println!("Hello, {name}");
}
```
````

All annotations are optional. `hl_lines` counts from the first code line, not
`linenostart`. Omit the language for plain text. Copying requires HTTPS or localhost.

### Callouts, quotes, disclosures, images, and video

Keep component calls outside lists. To display a literal component call in a code
block, wrap that block in `{% raw %}` and `{% endraw %}`.

```text
<!-- Callouts require [markdown] github_alerts = true in zola.toml.
     Types: NOTE, TIP, IMPORTANT, WARNING, CAUTION. -->
> [!NOTE]
> Additional context.

<!-- cite is optional; attribution supports Markdown. -->
{% <quote cite="*Author*"> %}
Quote text.
{% </quote> %}

<!-- Use default_open={true} to start expanded. -->
{% <detail title="Read more"> %}
Markdown content.
{% </detail> %}

<!-- Image beside index.md. In _index.md, pass section instead of page.
     caption, width, and height are optional; dimensions do not resize the file. -->
{{ <figure src="photo.webp" alt="Description" caption="**Caption**" width="600" height="400" page /> }}

<!-- Use only the video ID, without URL or sharing parameters. -->
{{ <youtube id="ueufxzUjsS0" /> }}
```

### Math and Mermaid

Set `math = true` and/or `mermaid = true` in the post's `[extra]`.

```text
Inline: $E = mc^2$

$$
\sum_{k=1}^{n} k = \frac{n(n+1)}{2}
$$

{% <mermaid> %}
flowchart LR
    A[Write] --> B[Publish]
{% </mermaid> %}
```

### ECharts

Save `chart.js` beside the post's `index.md`:

```js
export default {
  xAxis: { type: "category", data: ["A", "B", "C"] },
  yAxis: { type: "value" },
  series: [{ type: "bar", data: [3, 7, 5] }],
};
```

Add the chart to the post:

```text
{{ <echarts js_file="chart.js" title="Example values" height="400px" page /> }}
```

No front-matter switch is needed. Use `section` in `_index.md`, `gl={true}` for
3D, and `width`/`height` to set the container size. Modules may also export a
synchronous `(echarts) => option` function. Math, diagrams, and charts need
JavaScript and network access; 3D also needs WebGL.

## Optional settings

Search is enabled by `zola.toml.example`. Use `/` to open it and Escape to close.
To exclude a post, add `in_search_index = false` to its front matter.
Use the post footer's `.md` link to open its source.

For profile and sharing images, place `profile.png` in `content/` and add:

```toml
[extra]
avatar = "profile.png"        # Home profile image
avatar_resize = true          # Generate a 256×256 center crop
og_image = "profile.png"      # Default sharing preview
og_image_resize = true        # Fit within 1200×1200 without cropping
```

These resize options apply to local raster images only. They preserve originals
and do not resize post-body images. Omit the image settings to show neither image.

## Update the theme

```sh
git submodule update --remote themes/serenity
```
