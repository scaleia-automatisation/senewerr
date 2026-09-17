export function SchemaOrganization() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Medikool',
    url: 'https://medikool.sn',
    logo: 'https://medikool.sn/logo.png',
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'contact@medikool.sn',
      contactType: 'customer support',
      availableLanguage: ['French', 'Wolof'],
    },
    sameAs: [],
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function SchemaSoftwareApplication() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Medikool',
    applicationCategory: 'MedicalApplication',
    operatingSystem: 'Web, iOS, Android',
    url: 'https://medikool.sn',
    description:
      'Plateforme de coordination de parcours de santé au Sénégal : rendez-vous, ordonnances, pharmacies, mutuelle.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'XOF',
      description: 'Gratuit pour les patients',
    },
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function SchemaFAQ({
  questions,
}: {
  questions: { question: string; answer: string }[]
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: { '@type': 'Answer', text: q.answer },
    })),
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function SchemaArticle({
  title,
  description,
  author,
  publishedAt,
  modifiedAt,
  url,
  imageUrl,
}: {
  title: string
  description: string
  author: string
  publishedAt: string
  modifiedAt: string
  url: string
  imageUrl?: string
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    author: { '@type': 'Organization', name: author },
    publisher: {
      '@type': 'Organization',
      name: 'Medikool',
      logo: {
        '@type': 'ImageObject',
        url: 'https://medikool.sn/logo.png',
      },
    },
    datePublished: publishedAt,
    dateModified: modifiedAt,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    ...(imageUrl && { image: imageUrl }),
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function SchemaBreadcrumb({
  items,
}: {
  items: { name: string; url: string }[]
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `https://medikool.sn${item.url}`,
    })),
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function SchemaPhysician({
  name,
  specialty,
  telephone,
  addressLocality,
  addressCountry,
  url,
}: {
  name: string
  specialty: string
  telephone?: string
  addressLocality?: string
  addressCountry?: string
  url: string
}) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    name,
    medicalSpecialty: specialty,
    url,
    ...(telephone && { telephone }),
    ...(addressLocality && {
      address: {
        '@type': 'PostalAddress',
        addressLocality,
        addressCountry: addressCountry ?? 'SN',
      },
    }),
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export function SchemaPharmacy({
  name,
  telephone,
  addressLocality,
  addressCountry,
  url,
  openingHours,
}: {
  name: string
  telephone?: string
  addressLocality?: string
  addressCountry?: string
  url: string
  openingHours?: string[]
}) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Pharmacy',
    name,
    url,
    ...(telephone && { telephone }),
    ...(openingHours && { openingHours }),
    ...(addressLocality && {
      address: {
        '@type': 'PostalAddress',
        addressLocality,
        addressCountry: addressCountry ?? 'SN',
      },
    }),
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
