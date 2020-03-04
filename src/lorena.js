const chalkPipe = require('chalk-pipe')
const chalk = require('chalk')
const inquirer = require('inquirer')

// Matrix
const Matrix = require('./lib/matrix')

// Zenroom
const Zen = require('@caelum-tech/zenroom-lib')
const z = new Zen()


var questions = [
    {
      type: 'input',
      name: 'name',
      message: "What's the name of the IDspace"
    },
    {
      type: 'input',
      name: 'email',
      message: "What's your email"
    },
    {
      type: 'input',
      name: 'website',
      message: "What's your Website"
    }
  ]

  console.log(chalkPipe('bold', chalk.blue)('Lorena Client v1.2'))
  inquirer.prompt(questions).then(answers => {
    console.log(JSON.stringify(answers, null, '  '));
  })
