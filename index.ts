import { TemplateBinding } from '@angular/compiler/src/expression_parser/ast'
import { Lexer } from '@angular/compiler/src/expression_parser/lexer'
import { Parser } from '@angular/compiler/src/expression_parser/parser'

const bindings = ['tagName', 'directive', 'binding']
const imports = `import { Directive, Input, TemplateRef } from '@angular/core'`

function main() {
  let form = document.querySelector('form')
  let queryParams = new URLSearchParams(window.location.search)

  bindings.forEach(binding => {
    if (queryParams.has(binding)) {
      form[binding].value = queryParams.get(binding)
    }

    form[binding].addEventListener('input', render)
  })

  render()
}

function get(binding: string) {
  let form = document.querySelector('form')

  return form[binding].value
}

function escapeQueryParams(
  strings: TemplateStringsArray,
  ...values: string[]
) {
  return strings.reduce((result, str, i) => {
    result += str

    if (i < values.length) {
      result += encodeURIComponent(values[i])
    }

    return result
  }, '')
}

function render() {
  let output = document.querySelector('#output')
  let directiveOutput = document.querySelector('#directive')
  let errors = document.querySelector('#errors')
  let warnings = document.querySelector('#warnings')
  let directive = get('directive')
  let binding = get('binding')
  let tagName = get('tagName')
  let parser = new Parser(new Lexer())
  let result = parser.parseTemplateBindings(directive, binding, void 0)

  errors.textContent = result.errors.map(error => error.message).join('\n')
  warnings.textContent = result.warnings.join('\n')
  output.textContent = renderOutput(tagName, result.templateBindings)
  directiveOutput.textContent = renderDirective(
    directive,
    tagName,
    result.templateBindings
  )

  window.history.replaceState(
    null,
    '',
    escapeQueryParams`?tagName=${tagName}&directive=${directive}&binding=${binding}`
  )
}

function renderOutput(tagName, templateBindings: TemplateBinding[]) {
  let attributes = templateBindings
    .map(
      binding =>
        binding.keyIsVar
          ? binding.name !== '$implicit'
            ? `let-${binding.key}="${binding.name}"`
            : `let-${binding.key}`
          : binding.expression !== null
            ? `[${binding.key}]="${binding.expression.source.trim()}"`
            : `[${binding.key}]`
    )
    .join(' ')

  return unpad`
    <ng-template ${attributes}>
      <${tagName}></${tagName}>
    </ng-template>
  `
}

function renderDirective(
  directive,
  tagName,
  templateBindings: TemplateBinding[]
) {
  const className = ucfirst(directive)
  const hasVars = templateBindings.some(binding => binding.keyIsVar)
  const hasInputs = templateBindings.some(
    binding => !binding.keyIsVar && binding.expression !== null
  )

  return unpad`
    ${imports}${
    hasVars
      ? `\n    ${renderDirectiveContext(className, templateBindings)}`
      : ''
  }

    @Directive({
      selector: '[${directive}]'
    })
    export class ${className} {${
    hasInputs ? `\n${renderDirectiveInputs(templateBindings)}\n    ` : ''
  }
      constructor(templateRef: TemplateRef<${
        hasVars ? `${className}Context` : 'any'
      }>) {}
    }
  `
}

function renderDirectiveContext(
  className,
  templateBindings: TemplateBinding[]
) {
  let vars = [
    ...templateBindings
      .filter(binding => binding.keyIsVar)
      .map(v => `      ${v.name}: any;`)
  ].join('\n')

  return `
    export interface ${className}Context {\n${vars}
    }`
}

function renderDirectiveInputs(templateBindings: TemplateBinding[]) {
  const inputs = templateBindings.filter(
    binding => !binding.keyIsVar && binding.expression !== null
  )

  return inputs
    .map(input => `      @Input() ${input.key}: any = null;`)
    .join('\n')
}

function ucfirst(str: string) {
  return `${str[0].toUpperCase()}${str.slice(1)}`
}

export default function unpad(
  strings: TemplateStringsArray,
  ...values: string[]
) {
  const raw = typeof strings === 'string' ? [strings] : strings.raw

  let result = raw.reduce((result, rawStr, i) => {
    result += rawStr.replace(/\\\n[ \t]*/g, '').replace(/\\`/g, '`')

    if (i < values.length) {
      result += values[i]
    }

    return result
  }, '')

  const lines = result.split('\n')
  const indent = lines.reduce((min, l) => {
    let m = /^(\s+)\S+/.exec(l)

    if (!m) return min

    return Math.min(min, m[1].length)
  }, Infinity)

  if (indent !== 0) {
    result = lines.map(l => (l[0] === ' ' ? l.slice(indent) : l)).join('\n')
  }

  return result.trim().replace(/\\n/g, '\n')
}

main()
