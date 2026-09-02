// Public API of the messaging domain. Import from here only — never reach into
// ./services, ./components or ./hooks directly (enforced by eslint.config.js).

export * from "./services/messaging";
export * from "./services/notifications";
export * from "./services/notification-templates";
export * from "./components/chat-thread";
export * from "./components/notification-bell";
export * from "./components/notification-preferences";
