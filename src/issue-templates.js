'use strict';

! function () {

    module.exports = function (chalk) {

        function issuesContentTableLayoutTechnicolor(opts) {

            var b = chalk.gray.bold;
            var h = chalk.bold;

            var t, s;
            if (!!opts && opts.dim) {
                s = chalk.bold.bgWhite.white;
                t = chalk.bold.bgWhite.red;
            } else {
                s = chalk.bold.bgRed.red;
                t = chalk.bold.bgRed;
            }

            return [
                '{{#data}}',
                s('+') + s('-{{#util.pad}}-{{/util.pad                                                                                     }}-') + s('+'),
                '{{#title}}',
                s('| ') + t('{{#util.body}}{{{.}}}{{/util.body                                                                             }}') + s(' |'),
                '{{/title}}',
                s('+-{{#util.padleft}}-{{/util.padleft            }}-+-{{#util.padright}}-{{/util.padright                                         }}-+'),
                b('| ') + h('{{#util.key}}signature{{/util.key }}') + b(' | ') + '{{#util.value}}{{{creator}}} @ {{{created}}}{{/util.value }}' + b(' |'),
                '{{#meta}}',
                b('| ') + h('{{#util.key}}{{{key}}}{{/util.key}}') + b(' | ') + '{{#util.value}}{{{value}}}{{/util.value                    }}' + b(' |'),
                '{{/meta}}',
                b('| {{#util.pad}} {{/util.pad                                                                                                     }} |'),
                '{{#body}}',
                b('| ') + '{{#util.body}}{{{.}}}{{/util.body                                                                                }}' + b(' |'),
                '{{/body}}',
                '{{#comments}}',
                b('| {{#util.pad}} {{/util.pad                                                                                                     }} |'),
                b('+-{{#util.padleft}}-{{/util.padleft            }}-+-{{#util.padright}}-{{/util.padright                                         }}-+'),
                b('| ') + h('{{#util.key}}{{type}}{{/util.key }}') + b(' | ') + '{{#util.value}}{{{modifier}}} @ {{{modified}}}{{/util.value}}' + b(' |'),
                b('| ') + '{{#util.pad}} {{/util.pad                                                                                        }}' + b(' |'),
                '{{#body}}',
                b('| ') + '{{#util.body}}{{{.}}}{{/util.body                                                                                }}' + b(' |'),
                '{{/body}}',
                '{{/comments}}',
                b('+-{{#util.pad}}-{{/util.pad                                                                                                     }}-+'),
                '{{/data}}'
            ].join('\n');
        }

        function issuesSummaryTechnicolor(opts) {

            var b = chalk.gray.bold;

            var t, s;
            if (!!opts && opts.dim) {
                s = chalk.bold.bgWhite.white;
                t = chalk.bold.bgWhite.red;
            } else {
                s = chalk.bold.bgRed.red;
                t = chalk.bold.bgRed;
            }

            return [
                s('+-{{#util.pad}}-{{/util.pad}}-+'),
                s('| ') + t('{{#util.body}}ID     Assignee     Status       Title{{/util.body}}') + s(' |'),
                s('+-{{#util.pad}}-{{/util.pad}}-+'),
                '{{#data}}',
                b('| ') + '{{#util.curtailed}}{{#util.body}}{{#util.pad6}}{{{id}}}{{/util.pad6}} {{#util.pad12}}{{{assignee}}}{{/util.pad12}} {{#util.pad12}}{{{status}}}{{/util.pad12}} {{{title}}}{{/util.body}}{{/util.curtailed}}' + b(' |'),
                '{{/data}}',
                b('+-{{#util.pad}}-{{/util.pad}}-+'),
            ].join('\n');

        }

        return {
            issuesContentTableLayoutTechnicolor: issuesContentTableLayoutTechnicolor,
            issuesSummaryTechnicolor: issuesSummaryTechnicolor
        };
    };

}();