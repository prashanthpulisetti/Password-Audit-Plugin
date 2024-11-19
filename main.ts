import { Plugin, WorkspaceLeaf, ItemView, Setting, Notice } from "obsidian";

const VIEW_TYPE_PASSWORD_AUDIT = "password-audit-view";

export default class PasswordAuditPlugin extends Plugin {
    async onload() {
        // Register the custom view
        this.registerView(
            VIEW_TYPE_PASSWORD_AUDIT,
            (leaf) => new PasswordAuditView(leaf)
        );

        // Add a ribbon icon to open the Password Audit panel
        const ribbonIcon = this.addRibbonIcon(
            "lock", // Built-in lock icon
            "Password Audit",
            (evt: MouseEvent) => {
                this.activateView();
            }
        );
        ribbonIcon.addClass("password-audit-ribbon-icon");

        // Add command to open the Password Audit panel
        this.addCommand({
            id: "open-audit-panel",
            name: "Open audit panel",
            callback: () => {
                this.activateView();
            },
        });

        console.log("Password Audit Plugin loaded.");
    }

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

    onunload() {
        console.log("Password Audit Plugin unloaded.");
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
        return "Password audit";
    }

    // Specify the icon for the view
    getIcon(): string {
        return "lock"; // Built-in lock icon
    }

    async onOpen() {
        const container = (this.container = this.contentEl);
        if (!container) return;
        container.empty();

        container.createEl("h2", { text: "Password audit" });
        container.createEl("p", {
            text: "⚠️ Warning: Do not store passwords in Obsidian. Use a dedicated password manager.",
            cls: "password-warning",
        });

        const inputDiv = container.createDiv({ cls: "password-input-container" });
        new Setting(inputDiv)
            .setName("Analyze a password")
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
}
