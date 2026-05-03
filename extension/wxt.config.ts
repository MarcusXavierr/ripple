import { defineConfig } from "wxt"

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtRw/P41eQIElQOYeEgqMrTBrGIxEI1kq5OOr45j5nw2/S7nJM+hkL7u9DJT3HCxQryJpfFVmExWQHqxVx8GU0dZEn5ifVXqh0JH3hYfoCfJUfJ5f2rYjlVl0nChB/kvQ3h98A/ZVt37WMXdGEgTUztyoWQmSWodCxr6RnS7mDUnh5AzdU81N05jZd4IgimgLxJ5XKcIunTcruNyC43jQrzFrneeVoMOWUX6aHqLVapk7PB0rIUkNigpU9BM3txf7T9I8tLVEhG16XXE3NWhWtJuuw7elTZCvoyjElYubzPJuG4nwPoXIO+oAGvvpoP8Jgri6uESzxARyQMCHtzngwQIDAQAB",
    default_locale: "en",
    name: "__MSG_ext_name__",
    description: "__MSG_ext_description__",
    permissions: ["activeTab", "scripting", "storage", "tabs"],
    optional_host_permissions: ["https://*/*", "http://*/*"],
    externally_connectable: {
      matches: ["http://localhost:5173/*", "https://marcus-ripple.netlify.app/*"],
    },
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      128: "icon/128.png",
    },
    action: {
      default_icon: {
        16: "icon/16.png",
        32: "icon/32.png",
      },
      default_title: "__MSG_action_title__",
    },
  },
})
