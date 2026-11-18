# Headshots

Put people's photos in this folder.

**Rules** (the **Lint content** check on your pull request tests these):

| | |
|---|---|
| **Name** | the same as the person's file: `jane-doe.md` → `jane-doe.jpg` |
| **Shape** | **square** (crop with your phone's "Square" crop or any image editor) |
| **Size** | at least **400 × 400 px**, ideally **800 × 800 px** or more |
| **File** | `.jpg`, `.png`, or `.webp`, under **2 MB** |

Then add this line to the person's file in `src/content/people/`:

```yaml
photo: "./photos/jane-doe.jpg"
```

Only upload photos the person agreed to have on the website.
