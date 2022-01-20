import {handlebars} from 'hbs';

// Register a githubHost global helper to make links respect the GHE_HOST env var
handlebars.registerHelper('githubHost', () => process.env.GHE_HOST || 'github.com')

export const template = {
  comment: handlebars.compile(require(`./comment`)),
  issue: handlebars.compile(require(`./issue`)),
  issueFromMerge: handlebars.compile(require(`./issueFromMerge`)),
  titleChange: handlebars.compile(require(`./titleChange`)),
  reopenClosed: handlebars.compile(require(`./reopenClosed`))
}
