# The tag follows the @playwright/test version in package.json: the image already carries the
# browsers that version expects, so nothing is downloaded at build time.
FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /app

# Dependencies in a layer of their own, so editing a test does not reinstall them. `.npmrc` is
# deliberately not copied: `npm ci` does not read it, and it is the usual home of a registry token.
COPY package.json package-lock.json ./
RUN npm ci

# Listed one by one instead of `COPY . .`: the image then cannot absorb whatever else happens to
# sit next to the sources when the build context is a working copy rather than the committed tree.
COPY playwright.config.ts tsconfig.json allurerc.mjs eslint.config.mjs ./
COPY src ./src
COPY tests ./tests

# The run is unprivileged, and compose mounts these four directories from the host, so they have to
# exist and be writable before the container starts.
RUN mkdir -p test-results playwright-report allure-results allure-report \
  && chown -R pwuser:pwuser /app

USER pwuser

# No ENTRYPOINT: the command has to stay replaceable from the command line.
CMD ["npm", "test"]
