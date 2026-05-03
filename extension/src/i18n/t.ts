import { browser } from "wxt/browser"

export type MessageKey =
  | "ext_name"
  | "ext_description"
  | "action_title"
  | "popup_title"
  | "popup_tagline"
  | "popup_selected_tab_label"
  | "popup_clear_selected_tab"
  | "popup_no_tab_selected"
  | "popup_choose_tab"
  | "popup_use_current_tab"
  | "popup_grant_access"
  | "popup_stop_controlling"
  | "popup_tab_selected"
  | "popup_status_selected"
  | "popup_status_tab_closed"
  | "popup_status_unavailable"
  | "popup_reason_selected_tab_closed"
  | "popup_reason_selected_tab_incompatible"
  | "popup_reason_permission_lost"
  | "popup_loading_current_tab"
  | "reason_tab_no_controllable_url"
  | "reason_tab_chrome_internal"
  | "reason_tab_extension_page"
  | "reason_tab_file_unsupported"
  | "reason_tab_not_controllable"
  | "reason_invalid_remote_input_message"
  | "reason_no_selected_tab"
  | "reason_selected_tab_missing"
  | "reason_selected_tab_not_controllable"
  | "reason_unexpected_error"
  | "reason_unknown_content_message"
  | "reason_click_target_not_found"
  | "reason_click_execution_failed"
  | "reason_scroll_target_not_found"
  | "reason_scroll_execution_failed"
  | "reason_keyboard_contenteditable_out_of_scope"
  | "reason_keyboard_execution_failed"
  | "reason_keyboard_selection_unavailable"
  | "reason_keyboard_native_value_setter_unavailable"

type I18nLike = {
  getMessage: (key: string, substitutions?: string | string[]) => string
}

export function createTranslator(i18n: I18nLike) {
  return (key: MessageKey, substitutions?: string | string[]) => {
    const value = i18n.getMessage(key, substitutions)
    if (!value) throw new Error(`Missing extension i18n message: "${key}"`)
    return value
  }
}

export const t = createTranslator(browser.i18n as I18nLike)
