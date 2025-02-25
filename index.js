const tailwindcss = require("tailwindcss");
const atImport = require("postcss-import");
const postcss = require("postcss");
const CleanCSS = require("clean-css");
require("css.escape");
const path = require("path");
const { readFileSync, outputFileSync, existsSync } = require("fs-extra");
const CSSErrorOverlay = require("./errorOverlay");

let tailwindConfigFile = {};
const file = path.join(process.cwd(), "./tailwind.config.js");

if (existsSync(file)) {
  tailwindConfigFile = require(file);
}

const pathRel = (file) => path.relative(process.cwd(), file);

const minifyCSS = (css) => {
  const minified = new CleanCSS().minify(css);
  if (!minified.styles) {
    // At any point where we return CSS if it
    // errors we try to show an overlay.
    console.error("Error minifying stylesheet.");
    console.log(minified.errors);
    return CSSErrorOverlay(minified.errors[0]);
  }
  return minified.styles;
};

const getTailwindConfig = ({ inputDir, tailwindConfig = {} }) => {
  const config = {
    ...tailwindConfigFile,
    ...tailwindConfig,
  };

  if (!config.content) {
    return {
      content: [
        `${inputDir}/**/*.html`,
        `${inputDir}/**/*.js`,
        `${inputDir}/**/*.ts`,
        `${inputDir}/**/*.vue`,
        `${inputDir}/**/*.jsx`,
        `${inputDir}/**/*.tsx`,
        `${inputDir}/**/*.mdx`,
        `${inputDir}/**/*.md`,
        `${inputDir}/**/*.njk`,
        `${inputDir}/**/*.hbs`,
        `${inputDir}/**/*.liquid`,
      ],
      ...config,
    };
  }

  return config;
};

const compileTailwind = async (options) => {
  const tailwindConfig = getTailwindConfig(options);
  let result;

  try {
    const content = readFileSync(options.entry, "utf-8");
    result = await postcss()
      .use(atImport())
      .use(tailwindcss(tailwindConfig))
      .process(content, { from: options.entry });

    result.warnings().forEach((message) => {
      console.log(message.toString());
    });
  } catch (error) {
    result = {
      error: error.message,
    };
  }

  if (!result || !result.css) {
    console.error("Error compiling stylesheet.");
    console.log(result.error);
    outputFileSync(
      options.output,
      CSSErrorOverlay(result.error || "Error compiling stylesheet.")
    );
  } else {
    outputFileSync(options.output, minifyCSS(result.css));
  }
};

const tailwindPlugin = async (eleventyConfig, options = {}) => {
  if (!options.entry) {
    console.log(`No tailwind entry found.`);
    console.log(
      `Plugin expects options to include: { entry: "path/to/tailwind.css" }`
    );
    return;
  }

  if (!options.inputDir) {
    console.log(`No inputDir found.`);
    console.log(
      `Plugin expects inputDir to match your 11ty input directory. This is required to correctly purge CSS.`
    );
    return;
  }

  // Add the entry to the watch list
  eleventyConfig.addWatchTarget(options.entry);

  eleventyConfig.on("eleventy.beforeWatch", (changedFiles) => {
    // Recompile before --watch or --serve re-runs
    console.log("recompiling tailwind");
    compileTailwind(options);
  });

  // Compile on init
  console.log("building initial Tailwind");
  compileTailwind(options);
};

module.exports = tailwindPlugin;
