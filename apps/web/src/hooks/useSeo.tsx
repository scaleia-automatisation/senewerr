import { Helmet } from 'react-helmet-async'

interface SeoProps {
  title: string
  description: string
  canonical?: string
  ogImage?: string
  ogType?: 'website' | 'article'
  article?: {
    publishedTime: string
    modifiedTime: string
    author: string
    tags?: string[]
  }
  noIndex?: boolean
}

export function Seo({
  title,
  description,
  canonical,
  ogImage,
  ogType = 'website',
  article,
  noIndex,
}: SeoProps) {
  const baseUrl = 'https://medikool.sn'
  const fullCanonical = canonical ? `${baseUrl}${canonical}` : undefined
  const defaultOg = `${baseUrl}/og-default.png`

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {noIndex && <meta name="robots" content="noindex,nofollow" />}
      {fullCanonical && <link rel="canonical" href={fullCanonical} />}

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      {fullCanonical && <meta property="og:url" content={fullCanonical} />}
      <meta property="og:image" content={ogImage ?? defaultOg} />
      <meta property="og:site_name" content="Medikool" />
      <meta property="og:locale" content="fr_SN" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage ?? defaultOg} />

      {/* Article */}
      {article && (
        <meta property="article:published_time" content={article.publishedTime} />
      )}
      {article && (
        <meta property="article:modified_time" content={article.modifiedTime} />
      )}
      {article && (
        <meta property="article:author" content={article.author} />
      )}

      {/* hreflang */}
      {fullCanonical && (
        <link rel="alternate" hrefLang="fr" href={fullCanonical} />
      )}
      {fullCanonical && (
        <link rel="alternate" hrefLang="x-default" href={fullCanonical} />
      )}
    </Helmet>
  )
}
