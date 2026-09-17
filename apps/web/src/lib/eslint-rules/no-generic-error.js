/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce typed error codes in catch blocks (errorResponse/errRes/makeError)',
    },
    messages: {
      noGeneric:
        "Un catch doit mapper vers un code d'erreur typé (errorResponse/errRes/makeError). " +
        "Utilisez au minimum SYS_DB_ERROR ou SYS_TIMEOUT. Pas de message générique.",
    },
  },
  create(context) {
    return {
      CatchClause(node) {
        const body = node.body.body
        if (body.length === 0) return

        const src = context.getSourceCode()
        const hasMapping = body.some((stmt) => {
          const text = src.getText(stmt)
          return (
            text.includes('errorResponse') ||
            text.includes('errRes') ||
            text.includes('makeError') ||
            text.includes('SYS_DB_ERROR') ||
            text.includes('SYS_TIMEOUT') ||
            text.includes('SYS_MAINTENANCE')
          )
        })

        if (!hasMapping) {
          context.report({ node, messageId: 'noGeneric' })
        }
      },
    }
  },
}
