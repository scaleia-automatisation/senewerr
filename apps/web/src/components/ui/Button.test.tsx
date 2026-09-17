import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './Button'
import { StatusPill } from './StatusPill'

describe('Button', () => {
  it('affiche son libellé', () => {
    render(<Button>Se connecter</Button>)
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument()
  })

  it('état loading : aria-busy et bouton désactivé', () => {
    render(<Button loading>Envoyer</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-busy', 'true')
    expect(btn).toBeDisabled()
  })

  it('état disabled : bouton désactivé', () => {
    render(<Button disabled>Payer</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('déclenche onClick', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Ok</Button>)
    screen.getByRole('button').click()
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('ne déclenche pas onClick en loading', () => {
    const onClick = vi.fn()
    render(<Button loading onClick={onClick}>Ok</Button>)
    screen.getByRole('button').click()
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('StatusPill', () => {
  it('affiche toujours le libellé (pas seulement la couleur)', () => {
    render(<StatusPill status="success" label="Prête" />)
    expect(screen.getByText('Prête')).toBeInTheDocument()
  })
})
