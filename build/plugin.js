class AddHeaderCodePlugin {
  constructor(headerCode) {
    this.headerCode = headerCode;
  }

  apply(compiler) {
    compiler.hooks.emit.tapAsync('AddHeaderCodePlugin', (compilation, callback) => {
      for (const [chunkName, asset] of Object.entries(compilation.assets)) {
        if (chunkName.endsWith('.js')) {
          const originalSource = asset.source();
          const newSource = `${this.headerCode}${originalSource}`;
          compilation.assets[chunkName] = {
            source: () => newSource,
            size: () => newSource.length
          };
        }
      }
      callback();
    });
  }
}

module.exports = AddHeaderCodePlugin;