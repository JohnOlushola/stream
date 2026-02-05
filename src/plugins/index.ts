/**
 * Built-in Plugins
 * Export all default plugins
 */

export { quantity, type QuantityPluginOptions } from './quantity.js'
export { datetime, type DateTimePluginOptions } from './datetime.js'
export { email, type EmailPluginOptions } from './email.js'
export { url, type UrlPluginOptions } from './url.js'
export { phone, type PhonePluginOptions } from './phone.js'

// Default export for convenience
import { quantity } from './quantity.js'
import { datetime } from './datetime.js'
import { email } from './email.js'
import { url } from './url.js'
import { phone } from './phone.js'

export const plugins = {
  quantity,
  datetime,
  email,
  url,
  phone,
}
