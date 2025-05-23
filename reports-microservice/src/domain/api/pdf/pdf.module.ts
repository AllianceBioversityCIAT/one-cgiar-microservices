import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { PdfController } from './pdf.controller';
import Handlebars, { Exception } from 'handlebars';
import { ClarisaModule } from '../../tools/clarisa/clarisa.module';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  controllers: [PdfController],
  providers: [PdfService],
  exports: [PdfService],
  imports: [ClarisaModule, NotificationsModule],
})
export class PdfModule {
  public constructor() {
    Handlebars.registerHelper('safeEmpty', function (options) {
      const value: string = options.fn(this);
      if (value == null) {
        return new Handlebars.SafeString('Not Defined');
      } else if (value == '') {
        return new Handlebars.SafeString('Not Provided');
      } else {
        return value;
      }
    });

    Handlebars.registerHelper('percentage', function (options) {
      return new Handlebars.SafeString(`${options.fn(this) * 100}%`);
    });

    //taken from https://stackoverflow.com/a/30122739
    Handlebars.registerHelper(
      'mathOperator',
      function (lvalue, operator, rvalue) {
        lvalue = parseFloat(lvalue);
        rvalue = parseFloat(rvalue);

        return {
          '+': lvalue + rvalue,
          '-': lvalue - rvalue,
          '*': lvalue * rvalue,
          '/': lvalue / rvalue,
        }[operator];
      },
    );

    Handlebars.registerHelper(
      'stringContentCompare',
      function (lvalue, rvalue, options) {
        if (arguments.length != 3) {
          throw new Exception(
            '#stringContentCompare requires exactly one two arguments',
          );
        }

        if (
          !(
            (typeof lvalue === 'string' || lvalue instanceof String) &&
            (typeof rvalue === 'string' || rvalue instanceof String)
          )
        ) {
          throw new Exception(
            '#stringContentCompare requires the two arguments provided being strings',
          );
        }

        /*
          now that we know they are strings, here we are forcing the String objects
          (note the capital "S") to be converted to strings (primitive type), 
          to correctly use the localeCompare function
        */
        lvalue = lvalue.toString();
        rvalue = rvalue.toString();

        if (lvalue.localeCompare(rvalue, 'en', { sensitivity: 'base' }) == 0) {
          return options.fn(this);
        } else {
          return options.inverse(this);
        }
      },
    );

    Handlebars.registerHelper('inList', function (value, list: string) {
      const listArr = (list ?? '').split(',');
      return listArr.includes(value.toString());
    });

    Handlebars.registerHelper(
      'yesNoHelper',
      function (value, valueIfNotDefined) {
        if (arguments.length == 2) {
          return value == null ? valueIfNotDefined : value ? 'Yes' : 'No';
        }
        return value ? 'Yes' : 'No';
      },
    );

    Handlebars.registerHelper(
      'conditionalAttribiute',
      function (
        originalValue,
        valueToCompare,
        attribute,
        valueToApplyIfTrue,
        valueToApplyIfFalse,
      ) {
        return `${attribute}="${
          originalValue == valueToCompare
            ? valueToApplyIfTrue
            : valueToApplyIfFalse
        }"`;
      },
    );

    Handlebars.registerHelper('safeString', function (text) {
      return new Handlebars.SafeString(text);
    });

    Handlebars.registerHelper('ifEquals', function (arg1, arg2, options) {
      return arg1 == arg2 ? options.fn(this) : options.inverse(this);
    });

    Handlebars.registerHelper('ifNotEquals', function (arg1, arg2, options) {
      return arg1 != arg2 ? options.fn(this) : options.inverse(this);
    });

    Handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
      switch (operator) {
        case '==':
          return v1 == v2 ? options.fn(this) : options.inverse(this);
        case '===':
          return v1 === v2 ? options.fn(this) : options.inverse(this);
        case '!=':
          return v1 != v2 ? options.fn(this) : options.inverse(this);
        case '!==':
          return v1 !== v2 ? options.fn(this) : options.inverse(this);
        case '<':
          return v1 < v2 ? options.fn(this) : options.inverse(this);
        case '<=':
          return v1 <= v2 ? options.fn(this) : options.inverse(this);
        case '>':
          return v1 > v2 ? options.fn(this) : options.inverse(this);
        case '>=':
          return v1 >= v2 ? options.fn(this) : options.inverse(this);
        case '&&':
          return v1 && v2 ? options.fn(this) : options.inverse(this);
        case '||':
          return v1 || v2 ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    });

    Handlebars.registerHelper('or', function (...args) {
      return args.slice(0, -1).some(Boolean);
    });

    Handlebars.registerHelper('typeof', function (value) {
      return typeof value;
    });

    Handlebars.registerHelper('json', function (context) {
      return JSON.stringify(context, null, 2);
    });

    Handlebars.registerHelper('parseJSON', function (jsonString) {
      try {
        return JSON.parse(jsonString);
      } catch (e) {
        console.error('Error parsing JSON:', e);
        return [];
      }
    });

    Handlebars.registerHelper('ifAnd', function () {
      const args = Array.from(arguments);
      const options = args.pop();

      const allTrue = args.every(Boolean);

      return allTrue ? options.fn(this) : options.inverse(this);
    });
  }
}
