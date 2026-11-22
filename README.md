# pdf_converter

**Live site:** [Open pdf_converter](https://lim-jun-jie.github.io/pdf_converter/)

A private-by-design files-to-PDF tool. Arrange supported files, select which pages to include, and make a PDF without uploading content to a server. Files are processed locally in your browser.

## Clone and edit locally

Install Git and Python 3, then clone the repository:

```powershell
git clone https://github.com/Lim-Jun-Jie/pdf_converter.git
cd pdf_converter
```

Open the folder in your editor (for example, run `code .` to open it in VS Code). Edit `index.html`, `styles.css`, and `app.js` to change the site. No package installation or build step is needed.

To preview the site locally, start a static web server from the repository folder:

```powershell
python -m http.server 8000
```

Open [http://localhost:8000/](http://localhost:8000/) in your browser. PDF reading, PDF creation, and fonts load from CDNs, so those features require an internet connection.

## Use the site

Upload image files or PDFs. Each PDF page is rendered as a separate file entry; entries start selected and can be reordered or unchecked before export. Choose icon view for larger page previews or switch to list view. Select, deselect, or clear files in bulk with the selection actions.

Supported types include PDF, JPG/JPEG, PNG, GIF, WebP, BMP, SVG, and AVIF. Support for visual formats varies by browser; HEIC and TIFF may not open in every browser.

## Publish with GitHub Pages

The workflow in `.github/workflows/deploy.yml` deploys the site on every push to `main`. In the repository settings, choose **Pages → Build and deployment → Source: GitHub Actions**.
