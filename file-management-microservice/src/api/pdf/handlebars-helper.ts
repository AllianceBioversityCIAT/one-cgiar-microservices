import * as handlebars from 'handlebars';

handlebars.registerHelper(
  'stringContentCompare',
  function (str1, str2, options) {
    if (str1 === str2) {
      return options.fn(this);
    } else {
      return options.inverse(this);
    }
  },
);
