module.exports = function addComma() {
  return {
    transformer: function addComma(fileObj) {
      var content = fileObj.content;
      content = content.replace(/([^;]);?\s*$/g, '$1;\n');
      return {
        path: fileObj.path,
        content: content
      };
    }

  };
};
