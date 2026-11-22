# pdf_converter — Files to PDF

A small, private-by-design files-to-PDF website. Choose supported files or PDFs, arrange their page order, and download a PDF without uploading files to a server. Files and PDF pages are processed locally in your browser.

## Use it locally

Open `index.html` in a modern browser. No build step or package installation is needed. PDF reading, PDF creation, and fonts are loaded from CDNs, so an internet connection is needed for those features.

## Import PDF files

Drop or choose one or more PDFs to render each page as a separate file. Pages are added in document order and can be rearranged alongside other uploaded files before making the final PDF. Every entry is selected by default; uncheck entries you want to leave out. PDFs are read and rendered locally in your browser.

## Publish with GitHub Pages

1. Push this repository to GitHub on the `main` branch.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, select **GitHub Actions** as the source.
4. The included workflow deploys the site on each push to `main`. Find its URL under **Settings → Pages** or in the completed workflow run.

## Supported file types

PDF, JPG/JPEG, PNG, GIF, WebP, BMP, SVG, and AVIF files are accepted. Support for visual formats varies by browser; HEIC and TIFF may not open in every browser. Each uploaded file or extracted PDF page becomes one PDF page, fitted inside A4 or US Letter and exported at up to 2400 pixels on the longest edge.
