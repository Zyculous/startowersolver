# Star Tower Solver

An interactive 3D model and step-by-step solver for the **Duncan Star Tower** puzzle. The puzzle is a three-layer cylinder with a pentagram cut on the top and bottom and five colored side columns.

- **3D model**: turn the top, middle and bottom layers and flip the front cap; drag to look around.
- **Enter my puzzle**: copy your real puzzle's colors onto a flat map and load them into the model.
- **Solver**: a three-step solution (middle ring, then yellow top and green bottom, then columns) that you can play through or step one move at a time.
- **Algorithm library**: 10 algorithms for common cases, each with a diagram and a Watch button.
- **Method and notation guides**: how to reach each of the package's three difficulty goals.

It is a plain static site: no build step and no dependencies to install. three.js and the fonts load from public CDNs.

## Run it on GitHub Pages

1. Create a new repository on GitHub, for example `star-tower-solver`.
2. Upload everything in this folder to the repository root, including the hidden `.nojekyll` file and the `.github` folder. You can drag the files into the GitHub web uploader, or use git:
   ```bash
   cd star-tower-solver
   git init
   git add .
   git commit -m "Star Tower Solver"
   git branch -M main
   git remote add origin https://github.com/<your-username>/star-tower-solver.git
   git push -u origin main
   ```
3. On GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose branch **main** and folder **/ (root)**, then press **Save**.
5. After a minute or two the site is live at `https://<your-username>.github.io/star-tower-solver/`.

## Run it locally

Open `index.html` directly in a browser, or serve the folder:

```bash
npm start          # serves on http://localhost:8080 (uses npx http-server)
# or
python3 -m http.server 8080
```

## Tests

```bash
npm test
```

The tests check that every algorithm in the library does what its card says. They also check that the solver solves 200 random scrambles and 200 random hand-entered puzzles. The included GitHub Actions workflow (`.github/workflows/test.yml`) runs them on every push.

## Project layout

```
index.html                  page markup
css/style.css               styles (light and dark themes)
js/logic.js                 puzzle model, notation and solver (no DOM; also runs in Node)
js/app.js                   three.js rendering and page UI
test/test.js                algorithm and solver checks
.github/workflows/test.yml  runs the tests on GitHub
.nojekyll                   tells GitHub Pages to serve files as-is
```

## How the model works

- **Columns**: the five columns are numbered counter-clockwise from above. Column 0 is front-right, then back-right, back, back-left, and front-left.
- **Turns**: U, E and D turn a layer by 72° (one column) or 144° (`2`).
- **Flips**: `/` flips the front cap 180° around the axis pointing at you. The front cap is the two columns either side of the front star tip, plus that star point. The flip swaps the cap's top and bottom pieces and mirrors it left to right.
- **Algorithms**: these were found by computer search over this model.
- **Parity**: every flip moves the ten top and bottom wedges in pairs. So any position that needs an odd number of wedge swaps is impossible, and the color editor rejects it.

Unofficial fan project, not affiliated with Duncan Toys.
