export function matchingProductTag(requirement, productTags = []) {
  const tags = Array.isArray(productTags) ? productTags : []
  if (tags.length === 0) return ''
  const text = [requirement.title, requirement.details, requirement.description, ...(requirement.keywords || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return tags.find((tag) => tag && text.includes(tag.toLowerCase())) || ''
}
