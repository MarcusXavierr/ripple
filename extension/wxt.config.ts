import { defineConfig } from "wxt"

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtRw/P41eQIElQOYeEgqMrTBrGIxEI1kq5OOr45j5nw2/S7nJM+hkL7u9DJT3HCxQryJpfFVmExWQHqxVx8GU0dZEn5ifVXqh0JH3hYfoCfJUfJ5f2rYjlVl0nChB/kvQ3h98A/ZVt37WMXdGEgTUztyoWQmSWodCxr6RnS7mDUnh5AzdU81N05jZd4IgimgLxJ5XKcIunTcruNyC43jQrzFrneeVoMOWUX6aHqLVapk7PB0rIUkNigpU9BM3txf7T9I8tLVEhG16XXE3NWhWtJuuw7elTZCvoyjElYubzPJuG4nwPoXIO+oAGvvpoP8Jgri6uESzxARyQMCHtzngwQIDAQAB",
    name: "Ripple Remote Control",
    description: "Apply Ripple remote click events to the selected Chrome tab.",
    permissions: ["activeTab", "scripting", "storage"],
    host_permissions: ["<all_urls>"],
    externally_connectable: {
      matches: ["http://localhost:5173/*"],
    },
  },
})
