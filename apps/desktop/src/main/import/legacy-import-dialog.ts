// M11 legacy import dialog (clean-room). Electron Main openDialog wrapper; the
// renderer only ever receives an opaque selection_token, never filesystem paths.
export interface ImportDialogOptions {
  title?: string;
  properties?: Array<"openFile" | "multiSelections">;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface ImportDialogPort {
  showOpenDialog(options: ImportDialogOptions): Promise<{ canceled: boolean; filePaths: string[] }>;
}

export class ElectronImportDialog implements ImportDialogPort {
  constructor(private readonly dialog: {
    showOpenDialog(options: ImportDialogOptions): Promise<{ canceled: boolean; filePaths: string[] }>;
  }) {}
  showOpenDialog(options: ImportDialogOptions): Promise<{ canceled: boolean; filePaths: string[] }> {
    return this.dialog.showOpenDialog({
      title: options.title ?? "选择旧版数据文件（只读导入）",
      properties: options.properties ?? ["openFile", "multiSelections"],
      filters: options.filters ?? [
        { name: "旧版数据", extensions: ["json", "csv", "md"] },
        { name: "所有文件", extensions: ["*"] },
      ],
    });
  }
}
