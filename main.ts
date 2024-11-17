// src/main.ts
import { Plugin, WorkspaceLeaf, ItemView, Setting, Notice } from "obsidian";

const VIEW_TYPE_PASSWORD_AUDIT = "password-audit-view";

export default class PasswordAuditPlugin extends Plugin {
    async onload() {
        // Register a custom view
        this.registerView(
            VIEW_TYPE_PASSWORD_AUDIT,
            (leaf) => new PasswordAuditView(leaf)
        );

        // Add a command to open the audit panel
        this.addCommand({
            id: "open-audit-panel",
            name: "Open Audit Panel",
            callback: () => {
                this.activateView();
            },
        });

        // Add a command to generate a secure password
        this.addCommand({
            id: "generate-secure-password",
            name: "Generate Secure Password",
            callback: () => {
                this.activateView((view) => {
                    const password = this.generatePassword(16);
                    view.displayPassword(password);
                });
            },
        });

        console.log("Password Audit Plugin loaded.");
    }

    // Activate the custom view
    async activateView(callback?: (view: PasswordAuditView) => void) {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_PASSWORD_AUDIT);
        if (leaves.length === 0) {
            await this.app.workspace.getRightLeaf(false)?.setViewState({
                type: VIEW_TYPE_PASSWORD_AUDIT,
                active: true,
            });
        }
        const view = this.app.workspace
            .getLeavesOfType(VIEW_TYPE_PASSWORD_AUDIT)[0]
            ?.view as PasswordAuditView;
        if (callback && view) callback(view);
    }

    // Generate a secure password
    generatePassword(length: number): string {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()";
        return Array.from({ length }, () =>
            chars[
                Math.floor(
                    crypto.getRandomValues(new Uint32Array(1))[0] /
                        (0xffffffff + 1) *
                        chars.length
                )
            ]
        ).join("");
    }

    onunload() {
        console.log("Password Audit Plugin unloaded.");
        // Cleanup styles if injected
        const style = document.querySelector("style.password-audit-style");
        if (style) style.remove();
    }
}

class PasswordAuditView extends ItemView {
    private container: HTMLElement | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return VIEW_TYPE_PASSWORD_AUDIT;
    }

    getDisplayText(): string {
        return "Password Audit";
    }

    async onOpen() {
        const container = (this.container = this.contentEl);
        if (!container) return;
        container.empty();
        this.injectCSS();

        container.createEl("h2", { text: "Password Audit" });

        const inputDiv = container.createDiv({ cls: "password-input-container" });
        new Setting(inputDiv)
            .setName("Analyze a Password")
            .setDesc("Enter a password to check its strength and breaches.")
            .addText((text) => {
                text.setPlaceholder("Enter password...")
                    .onChange(async (password) => {
                        const strength = this.analyzeStrength(password);
                        const breached = await this.checkPasswordBreach(password);
                        this.displayAnalysis(strength, breached);
                    });
            });

        const resultsDiv = container.createDiv({ cls: "password-results-container" });
        resultsDiv.createEl("p", { text: "Password analysis results will appear here." });
    }

    async onClose() {
        this.container?.empty();
    }

    displayAnalysis(strength: string, breached: boolean) {
        const resultsDiv = this.container?.querySelector(".password-results-container");
        if (!resultsDiv) return;

        resultsDiv.empty();
        resultsDiv.createEl("p", {
            text: `Strength: ${strength}`,
            cls: `strength-${strength.toLowerCase().split(" ")[0]}`,
        });

        resultsDiv.createEl("p", {
            text: breached
                ? "⚠️ This password has been breached!"
                : "✅ This password is safe from breaches.",
            cls: breached ? "breach-warning" : "breach-safe",
        });
    }

    displayPassword(password: string) {
        const resultsDiv = this.container?.querySelector(".password-results-container");
        if (!resultsDiv) return;

        resultsDiv.empty();

        // Display the generated password
        resultsDiv.createEl("p", { text: `Generated Password: ${password}` });

        // Add a "Copy" button
        const copyButton = resultsDiv.createEl("button", { text: "Copy Password" });
        copyButton.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(password);
                new Notice("Password copied to clipboard!");
            } catch (err) {
                console.error("Failed to copy password: ", err);
                new Notice("Failed to copy password.");
            }
        });
    }

    analyzeStrength(password: string): string {
        if (password.length < 8) return "Weak (too short)";
        if (!/[A-Z]/.test(password)) return "Weak (no uppercase letters)";
        if (!/[a-z]/.test(password)) return "Weak (no lowercase letters)";
        if (!/\d/.test(password)) return "Weak (no numbers)";
        if (!/[!@#$%^&*()]/.test(password)) return "Medium (no special characters)";
        return "Strong";
    }

    async checkPasswordBreach(password: string): Promise<boolean> {
        try {
            const hash = await this.hashPassword(password);
            const prefix = hash.substring(0, 5);
            const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
            const text = await response.text();
            const breaches = text.split("\n");
            return breaches.some((line) => line.startsWith(hash.substring(5).toUpperCase()));
        } catch (error) {
            console.error("Error checking password breach:", error);
            new Notice("Failed to check password breach. Please try again later.");
            return false;
        }
    }

    async hashPassword(password: string): Promise<string> {
        const msgUint8 = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest("SHA-1", msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    injectCSS() {
        if (document.querySelector("style.password-audit-style")) return; // Prevent duplicate injection
        const style = document.createElement("style");
        style.classList.add("password-audit-style");
        style.innerText = `
        .password-input-container { margin-bottom: 16px; }
        .password-results-container {
            padding: 8px; border: 1px solid var(--background-modifier-border);
            border-radius: 4px; background-color: var(--background-primary);
            margin-top: 16px;
        }
        .strength-weak { color: #e63946; font-weight: bold; }
        .strength-medium { color: #ffb703; font-weight: bold; }
        .strength-strong { color: #2a9d8f; font-weight: bold; }
        .breach-warning { color: #e63946; }
        .breach-safe { color: #2a9d8f; }
        button {
            margin-top: 8px;
            padding: 6px 12px;
            font-size: 14px;
            color: #fff;
            background-color: #2a9d8f;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        button:hover {
            background-color: #21867a;
        }
        button:active {
            background-color: #1b6d64;
        }
        `;
        document.head.appendChild(style);
    }
}
