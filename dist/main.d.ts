import { Plugin, WorkspaceLeaf, ItemView } from "obsidian";
export default class PasswordAuditPlugin extends Plugin {
    onload(): Promise<void>;
    activateView(callback?: (view: PasswordAuditView) => void): Promise<void>;
    generatePassword(length: number): string;
    onunload(): void;
}
declare class PasswordAuditView extends ItemView {
    private container;
    constructor(leaf: WorkspaceLeaf);
    getViewType(): string;
    getDisplayText(): string;
    onOpen(): Promise<void>;
    onClose(): Promise<void>;
    displayAnalysis(strength: string, breached: boolean): void;
    displayPassword(password: string): void;
    analyzeStrength(password: string): string;
    checkPasswordBreach(password: string): Promise<boolean>;
    hashPassword(password: string): Promise<string>;
    injectCSS(): void;
}
export {};
