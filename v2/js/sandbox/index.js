var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
define(["require", "exports", "./typeAcquisition", "./theme", "./compilerOptions", "./vendor/lzstring.min", "./releases", "./getInitialCode", "./twoslashSupport", "./vendor/typescript-vfs"], function (require, exports, typeAcquisition_1, theme_1, compilerOptions_1, lzstring_min_1, releases_1, getInitialCode_1, twoslashSupport_1, tsvfs) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    lzstring_min_1 = __importDefault(lzstring_min_1);
    tsvfs = __importStar(tsvfs);
    const languageType = (config) => (config.useJavaScript ? 'javascript' : 'typescript');
    /** Default Monaco settings for playground */
    const sharedEditorOptions = {
        automaticLayout: true,
        scrollBeyondLastLine: true,
        scrollBeyondLastColumn: 3,
        minimap: {
            enabled: false,
        },
    };
    /** The default settings which we apply a partial over */
    function defaultPlaygroundSettings() {
        const config = {
            text: '',
            domID: '',
            compilerOptions: {},
            acquireTypes: true,
            useJavaScript: false,
            supportTwoslashCompilerOptions: false,
            logger: {
                error: () => { },
                log: () => { },
            },
        };
        return config;
    }
    exports.defaultPlaygroundSettings = defaultPlaygroundSettings;
    function defaultFilePath(config, compilerOptions, monaco) {
        const isJSX = compilerOptions.jsx !== monaco.languages.typescript.JsxEmit.None;
        const fileExt = config.useJavaScript ? 'js' : 'ts';
        const ext = isJSX ? fileExt + 'x' : fileExt;
        return 'input.' + ext;
    }
    /** Creates a monaco file reference, basically a fancy path */
    function createFileUri(config, compilerOptions, monaco) {
        return monaco.Uri.file(defaultFilePath(config, compilerOptions, monaco));
    }
    /** Creates a sandbox editor, and returns a set of useful functions and the editor */
    exports.createTypeScriptSandbox = (partialConfig, monaco, ts) => {
        const config = Object.assign(Object.assign({}, defaultPlaygroundSettings()), partialConfig);
        if (!('domID' in config) && !('elementToAppend' in config))
            throw new Error('You did not provide a domID or elementToAppend');
        const compilerDefaults = compilerOptions_1.getDefaultSandboxCompilerOptions(config, monaco);
        const language = languageType(config);
        const filePath = createFileUri(config, compilerDefaults, monaco);
        const element = 'domID' in config ? document.getElementById(config.domID) : config.elementToAppend;
        const defaultText = config.suppressAutomaticallyGettingDefaultText
            ? config.text
            : getInitialCode_1.getInitialCode(config.text, document.location);
        const model = monaco.editor.createModel(defaultText, language, filePath);
        monaco.editor.defineTheme('sandbox', theme_1.sandboxTheme);
        monaco.editor.defineTheme('sandbox-dark', theme_1.sandboxThemeDark);
        monaco.editor.setTheme('sandbox');
        const monacoSettings = Object.assign({ model }, sharedEditorOptions, config.monacoSettings || {});
        const editor = monaco.editor.create(element, monacoSettings);
        const getWorker = config.useJavaScript
            ? monaco.languages.typescript.getJavaScriptWorker
            : monaco.languages.typescript.getTypeScriptWorker;
        const defaults = config.useJavaScript
            ? monaco.languages.typescript.javascriptDefaults
            : monaco.languages.typescript.typescriptDefaults;
        // In the future it'd be good to add support for an 'add many files'
        const addLibraryToRuntime = (code, path) => {
            defaults.addExtraLib(code, path);
            config.logger.log(`[ATA] Adding ${path} to runtime`);
        };
        // Grab types
        if (config.acquireTypes) {
            // Take the code from the editor right away
            const code = editor.getModel().getValue();
            typeAcquisition_1.detectNewImportsToAcquireTypeFor(code, addLibraryToRuntime, window.fetch.bind(window), config);
        }
        const getTwoSlashComplierOptions = twoslashSupport_1.extractTwoSlashComplierOptions(ts);
        // Then update it when the model changes, perhaps this could be a debounced plugin instead in the future?
        editor.onDidChangeModelContent(() => {
            const code = editor.getModel().getValue();
            if (config.supportTwoslashCompilerOptions) {
                const configOpts = getTwoSlashComplierOptions(code);
                updateCompilerSettings(configOpts);
            }
            if (config.acquireTypes) {
                typeAcquisition_1.detectNewImportsToAcquireTypeFor(code, addLibraryToRuntime, window.fetch.bind(window), config);
            }
        });
        // Grab the compiler flags via the query params
        let compilerOptions;
        if (!config.suppressAutomaticallyGettingCompilerFlags) {
            const params = new URLSearchParams(location.search);
            let queryParamCompilerOptions = compilerOptions_1.getCompilerOptionsFromParams(compilerDefaults, params);
            if (Object.keys(queryParamCompilerOptions).length)
                config.logger.log('[Compiler] Found compiler options in query params: ', queryParamCompilerOptions);
            compilerOptions = Object.assign(Object.assign({}, compilerDefaults), queryParamCompilerOptions);
        }
        else {
            compilerOptions = compilerDefaults;
        }
        config.logger.log('[Compiler] Set compiler options: ', compilerOptions);
        defaults.setCompilerOptions(compilerOptions);
        // To let clients plug into compiler settings changes
        let didUpdateCompilerSettings = (opts) => { };
        const updateCompilerSettings = (opts) => {
            config.logger.log('[Compiler] Updating compiler options: ', opts);
            compilerOptions = Object.assign(Object.assign({}, opts), compilerOptions);
            defaults.setCompilerOptions(compilerOptions);
            didUpdateCompilerSettings(compilerOptions);
        };
        const updateCompilerSetting = (key, value) => {
            config.logger.log('[Compiler] Setting compiler options ', key, 'to', value);
            compilerOptions[key] = value;
            defaults.setCompilerOptions(compilerOptions);
            didUpdateCompilerSettings(compilerOptions);
        };
        const setCompilerSettings = (opts) => {
            config.logger.log('[Compiler] Setting compiler options: ', opts);
            compilerOptions = opts;
            defaults.setCompilerOptions(compilerOptions);
            didUpdateCompilerSettings(compilerOptions);
        };
        const getCompilerOptions = () => {
            return compilerOptions;
        };
        const setDidUpdateCompilerSettings = (func) => {
            didUpdateCompilerSettings = func;
        };
        /** Gets the results of compiling your editor's code */
        const getEmitResult = () => __awaiter(void 0, void 0, void 0, function* () {
            const model = editor.getModel();
            const client = yield getWorkerProcess();
            return yield client.getEmitOutput(model.uri.toString());
        });
        /** Gets the JS  of compiling your editor's code */
        const getRunnableJS = () => __awaiter(void 0, void 0, void 0, function* () {
            if (config.useJavaScript) {
                return getText();
            }
            const result = yield getEmitResult();
            const firstJS = result.outputFiles.find((o) => o.name.endsWith('.js') || o.name.endsWith('.jsx'));
            return (firstJS && firstJS.text) || '';
        });
        /** Gets the DTS for the JS/TS  of compiling your editor's code */
        const getDTSForCode = () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield getEmitResult();
            return result.outputFiles.find((o) => o.name.endsWith('.d.ts')).text;
        });
        const getWorkerProcess = () => __awaiter(void 0, void 0, void 0, function* () {
            const worker = yield getWorker();
            return yield worker(model.uri);
        });
        const getDomNode = () => editor.getDomNode();
        const getModel = () => editor.getModel();
        const getText = () => getModel().getValue();
        const setText = (text) => getModel().setValue(text);
        /**
         * Warning: Runs on the main thread
         */
        const createTSProgram = () => __awaiter(void 0, void 0, void 0, function* () {
            const fsMap = yield tsvfs.createDefaultMapFromCDN(compilerOptions, ts.version, true, ts, lzstring_min_1.default);
            fsMap.set(filePath.path, getText());
            const system = tsvfs.createSystem(fsMap);
            const host = tsvfs.createVirtualCompilerHost(system, compilerOptions, ts);
            const program = ts.createProgram({
                rootNames: [...fsMap.keys()],
                options: compilerOptions,
                host: host.compilerHost,
            });
            return program;
        });
        const getAST = () => __awaiter(void 0, void 0, void 0, function* () {
            const program = yield createTSProgram();
            program.emit();
            return program.getSourceFile(filePath.path);
        });
        // Pass along the supported releases for the playground
        const supportedVersions = releases_1.supportedReleases;
        return {
            /** The same config you passed in */
            config,
            /** A list of TypeScript versions you can use with the TypeScript sandbox */
            supportedVersions,
            /** The monaco editor instance */
            editor,
            /** Either "typescript" or "javascript" depending on your config */
            language,
            /** The outer monaco module, the result of require("monaco-editor")  */
            monaco,
            /** Gets a monaco-typescript worker, this will give you access to a language server. Note: prefer this for language server work because it happens on a webworker . */
            getWorkerProcess,
            /** A copy of require("typescript-vfs") this can be used to quickly set up an in-memory compiler runs for ASTs, or to get complex language server results (anything above has to be serialized when passed)*/
            tsvfs,
            /** Get all the different emitted files after TypeScript is run */
            getEmitResult,
            /** Gets just the JavaScript for your sandbox, will transpile if in TS only */
            getRunnableJS,
            /** Gets the DTS output of the main code in the editor */
            getDTSForCode,
            /** The monaco-editor dom node, used for showing/hiding the editor */
            getDomNode,
            /** The model is an object which monaco uses to keep track of text in the editor. Use this to directly modify the text in the editor */
            getModel,
            /** Gets the text of the main model, which is the text in the editor */
            getText,
            /** Shortcut for setting the model's text content which would update the editor */
            setText,
            /** WIP: Gets the AST of the current text */
            getAST,
            /** The module you get from  require("typescript") */
            ts,
            /** Create a new Program, a TypeScript data model which represents the entire project.
             *
             * The first time this is called it has to download all the DTS files which is needed for an exact compiler run. Which
             * at max is about 1.5MB - after that subsequent downloads of dts lib files come from localStorage.
             *
             * You probably want
             */
            createTSProgram,
            /** The Sandbox's default compiler options  */
            compilerDefaults,
            /** The Sandbox's current compiler options */
            getCompilerOptions,
            /** Replace the Sandbox's compiler options */
            setCompilerSettings,
            /** Overwrite the Sandbox's compiler options */
            updateCompilerSetting,
            /** Update a single compiler option in the SAndbox */
            updateCompilerSettings,
            /** A way to get callbacks when compiler settings have changed */
            setDidUpdateCompilerSettings,
            /** A copy of lzstring, which is used to archive/unarchive code */
            lzstring: lzstring_min_1.default,
            /** Returns compiler options found in the params of the current page */
            getURLQueryWithCompilerOptions: compilerOptions_1.getURLQueryWithCompilerOptions,
            /** Returns compiler options in the source code using twoslash notation */
            getTwoSlashComplierOptions,
            /** Gets to the current monaco-language, this is how you talk to the background webworkers */
            languageServiceDefaults: defaults,
        };
    };
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zYW5kYm94L3NyYy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUE4Q0EsTUFBTSxZQUFZLEdBQUcsQ0FBQyxNQUF3QixFQUFFLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUE7SUFFdkcsNkNBQTZDO0lBQzdDLE1BQU0sbUJBQW1CLEdBQWtEO1FBQ3pFLGVBQWUsRUFBRSxJQUFJO1FBQ3JCLG9CQUFvQixFQUFFLElBQUk7UUFDMUIsc0JBQXNCLEVBQUUsQ0FBQztRQUN6QixPQUFPLEVBQUU7WUFDUCxPQUFPLEVBQUUsS0FBSztTQUNmO0tBQ0YsQ0FBQTtJQUVELHlEQUF5RDtJQUN6RCxTQUFnQix5QkFBeUI7UUFDdkMsTUFBTSxNQUFNLEdBQXFCO1lBQy9CLElBQUksRUFBRSxFQUFFO1lBQ1IsS0FBSyxFQUFFLEVBQUU7WUFDVCxlQUFlLEVBQUUsRUFBRTtZQUNuQixZQUFZLEVBQUUsSUFBSTtZQUNsQixhQUFhLEVBQUUsS0FBSztZQUNwQiw4QkFBOEIsRUFBRSxLQUFLO1lBQ3JDLE1BQU0sRUFBRTtnQkFDTixLQUFLLEVBQUUsR0FBRyxFQUFFLEdBQUUsQ0FBQztnQkFDZixHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUUsQ0FBQzthQUNkO1NBQ0YsQ0FBQTtRQUNELE9BQU8sTUFBTSxDQUFBO0lBQ2YsQ0FBQztJQWRELDhEQWNDO0lBRUQsU0FBUyxlQUFlLENBQUMsTUFBd0IsRUFBRSxlQUFnQyxFQUFFLE1BQWM7UUFDakcsTUFBTSxLQUFLLEdBQUcsZUFBZSxDQUFDLEdBQUcsS0FBSyxNQUFNLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFBO1FBQzlFLE1BQU0sT0FBTyxHQUFHLE1BQU0s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S0FBc0s7WUFDdEssZ0JBQWdCO1lBQ2hCLDZNQUE2TTtZQUM3TSxLQUFLO1lBQ0wsa0VBQWtFO1lBQ2xFLGFBQWE7WUFDYiw4RUFBOEU7WUFDOUUsYUFBYTtZQUNiLHlEQUF5RDtZQUN6RCxhQUFhO1lBQ2IscUVBQXFFO1lBQ3JFLFVBQVU7WUFDVix1SUFBdUk7WUFDdkksUUFBUTtZQUNSLHVFQUF1RTtZQUN2RSxPQUFPO1lBQ1Asa0ZBQWtGO1lBQ2xGLE9BQU87WUFDUCw0Q0FBNEM7WUFDNUMsTUFBTTtZQUNOLHFEQUFxRDtZQUNyRCxFQUFFO1lBQ0Y7Ozs7OztlQU1HO1lBQ0gsZUFBZTtZQUNmLDhDQUE4QztZQUM5QyxnQkFBZ0I7WUFDaEIsNkNBQTZDO1lBQzdDLGtCQUFrQjtZQUNsQiw2Q0FBNkM7WUFDN0MsbUJBQW1CO1lBQ25CLCtDQUErQztZQUMvQyxxQkFBcUI7WUFDckIscURBQXFEO1lBQ3JELHNCQUFzQjtZQUN0QixpRUFBaUU7WUFDakUsNEJBQTRCO1lBQzVCLGtFQUFrRTtZQUNsRSxRQUFRLEVBQVIsc0JBQVE7WUFDUix1RUFBdUU7WUFDdkUsOEJBQThCLEVBQTlCLGdEQUE4QjtZQUM5QiwwRUFBMEU7WUFDMUUsMEJBQTBCO1lBQzFCLDZGQUE2RjtZQUM3Rix1QkFBdUIsRUFBRSxRQUFRO1NBQ2xDLENBQUE7SUFDSCxDQUFDLENBQUEiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBjcmVhdGVDb21waWxlckhvc3QgfSBmcm9tICcuL2NyZWF0ZUNvbXBpbGVySG9zdCdcbmltcG9ydCB7IGRldGVjdE5ld0ltcG9ydHNUb0FjcXVpcmVUeXBlRm9yIH0gZnJvbSAnLi90eXBlQWNxdWlzaXRpb24nXG5pbXBvcnQgeyBzYW5kYm94VGhlbWUsIHNhbmRib3hUaGVtZURhcmsgfSBmcm9tICcuL3RoZW1lJ1xuaW1wb3J0IHsgVHlwZVNjcmlwdFdvcmtlciB9IGZyb20gJy4vdHNXb3JrZXInXG5pbXBvcnQge1xuICBnZXREZWZhdWx0U2FuZGJveENvbXBpbGVyT3B0aW9ucyxcbiAgZ2V0Q29tcGlsZXJPcHRpb25zRnJvbVBhcmFtcyxcbiAgZ2V0VVJMUXVlcnlXaXRoQ29tcGlsZXJPcHRpb25zLFxufSBmcm9tICcuL2NvbXBpbGVyT3B0aW9ucydcbmltcG9ydCBsenN0cmluZyBmcm9tICcuL3ZlbmRvci9senN0cmluZy5taW4nXG5pbXBvcnQgeyBzdXBwb3J0ZWRSZWxlYXNlcyB9IGZyb20gJy4vcmVsZWFzZXMnXG5pbXBvcnQgeyBnZXRJbml0aWFsQ29kZSB9IGZyb20gJy4vZ2V0SW5pdGlhbENvZGUnXG5pbXBvcnQgeyBleHRyYWN0VHdvU2xhc2hDb21wbGllck9wdGlvbnMgfSBmcm9tICcuL3R3b3NsYXNoU3VwcG9ydCdcbmltcG9ydCAqIGFzIHRzdmZzIGZyb20gJy4vdmVuZG9yL3R5cGVzY3JpcHQtdmZzJ1xuXG50eXBlIENvbXBpbGVyT3B0aW9ucyA9IGltcG9ydCgnbW9uYWNvLWVkaXRvcicpLmxhbmd1YWdlcy50eXBlc2NyaXB0LkNvbXBpbGVyT3B0aW9uc1xudHlwZSBNb25hY28gPSB0eXBlb2YgaW1wb3J0KCdtb25hY28tZWRpdG9yJylcblxuLyoqXG4gKiBUaGVzZSBhcmUgc2V0dGluZ3MgZm9yIHRoZSBwbGF5Z3JvdW5kIHdoaWNoIGFyZSB0aGUgZXF1aXZhbGVudCB0byBwcm9wcyBpbiBSZWFjdFxuICogYW55IGNoYW5nZXMgdG8gaXQgc2hvdWxkIHJlcXVpcmUgYSBuZXcgc2V0dXAgb2YgdGhlIHBsYXlncm91bmRcbiAqL1xuZXhwb3J0IHR5cGUgUGxheWdyb3VuZENvbmZpZyA9IHtcbiAgLyoqIFRoZSBkZWZhdWx0IHNvdXJjZSBjb2RlIGZvciB0aGUgcGxheWdyb3VuZCAqL1xuICB0ZXh0OiBzdHJpbmdcbiAgLyoqIFNob3VsZCBpdCBydW4gdGhlIHRzIG9yIGpzIElERSBzZXJ2aWNlcyAqL1xuICB1c2VKYXZhU2NyaXB0OiBib29sZWFuXG4gIC8qKiBDb21waWxlciBvcHRpb25zIHdoaWNoIGFyZSBhdXRvbWF0aWNhbGx5IGp1c3QgZm9yd2FyZGVkIG9uICovXG4gIGNvbXBpbGVyT3B0aW9uczogQ29tcGlsZXJPcHRpb25zXG4gIC8qKiBPcHRpb25hbCBtb25hY28gc2V0dGluZ3Mgb3ZlcnJpZGVzICovXG4gIG1vbmFjb1NldHRpbmdzPzogaW1wb3J0KCdtb25hY28tZWRpdG9yJykuZWRpdG9yLklFZGl0b3JPcHRpb25zXG4gIC8qKiBBY3F1aXJlIHR5cGVzIHZpYSB0eXBlIGFjcXVpc2l0aW9uICovXG4gIGFjcXVpcmVUeXBlczogYm9vbGVhblxuICAvKiogU3VwcG9ydCB0d29zbGFzaCBjb21waWxlciBvcHRpb25zICovXG4gIHN1cHBvcnRUd29zbGFzaENvbXBpbGVyT3B0aW9uczogYm9vbGVhblxuICAvKiogR2V0IHRoZSB0ZXh0IHZpYSBxdWVyeSBwYXJhbXMgYW5kIGxvY2FsIHN0b3JhZ2UsIHVzZWZ1bCB3aGVuIHRoZSBlZGl0b3IgaXMgdGhlIG1haW4gZXhwZXJpZW5jZSAqL1xuICBzdXBwcmVzc0F1dG9tYXRpY2FsbHlHZXR0aW5nRGVmYXVsdFRleHQ/OiB0cnVlXG4gIC8qKiBTdXBwcmVzcyBzZXR0aW5nIGNvbXBpbGVyIG9wdGlvbnMgZnJvbSB0aGUgY29tcGlsZXIgZmxhZ3MgZnJvbSBxdWVyeSBwYXJhbXMgKi9cbiAgc3VwcHJlc3NBdXRvbWF0aWNhbGx5R2V0dGluZ0NvbXBpbGVyRmxhZ3M/OiB0cnVlXG4gIC8qKiBMb2dnaW5nIHN5c3RlbSAqL1xuICBsb2dnZXI6IHsgbG9nOiAoLi4uYXJnczogYW55W10pID0+IHZvaWQ7IGVycm9yOiAoLi4uYXJnczogYW55W10pID0+IHZvaWQgfVxufSAmIChcbiAgfCB7IC8qKiB0aGVJRCBvZiBhIGRvbSBub2RlIHRvIGFkZCBtb25hY28gdG8gKi8gZG9tSUQ6IHN0cmluZyB9XG4gIHwgeyAvKiogdGhlSUQgb2YgYSBkb20gbm9kZSB0byBhZGQgbW9uYWNvIHRvICovIGVsZW1lbnRUb0FwcGVuZDogSFRNTEVsZW1lbnQgfVxuKVxuXG5jb25zdCBsYW5ndWFnZVR5cGUgPSAoY29uZmlnOiBQbGF5Z3JvdW5kQ29uZmlnKSA9PiAoY29uZmlnLnVzZUphdmFTY3JpcHQgPyAnamF2YXNjcmlwdCcgOiAndHlwZXNjcmlwdCcpXG5cbi8qKiBEZWZhdWx0IE1vbmFjbyBzZXR0aW5ncyBmb3IgcGxheWdyb3VuZCAqL1xuY29uc3Qgc2hhcmVkRWRpdG9yT3B0aW9uczogaW1wb3J0KCdtb25hY28tZWRpdG9yJykuZWRpdG9yLklFZGl0b3JPcHRpb25zID0ge1xuICBhdXRvbWF0aWNMYXlvdXQ6IHRydWUsXG4gIHNjcm9sbEJleW9uZExhc3RMaW5lOiB0cnVlLFxuICBzY3JvbGxCZXlvbmRMYXN0Q29sdW1uOiAzLFxuICBtaW5pbWFwOiB7XG4gICAgZW5hYmxlZDogZmFsc2UsXG4gIH0sXG59XG5cbi8qKiBUaGUgZGVmYXVsdCBzZXR0aW5ncyB3aGljaCB3ZSBhcHBseSBhIHBhcnRpYWwgb3ZlciAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlZmF1bHRQbGF5Z3JvdW5kU2V0dGluZ3MoKSB7XG4gIGNvbnN0IGNvbmZpZzogUGxheWdyb3VuZENvbmZpZyA9IHtcbiAgICB0ZXh0OiAnJyxcbiAgICBkb21JRDogJycsXG4gICAgY29tcGlsZXJPcHRpb25zOiB7fSxcbiAgICBhY3F1aXJlVHlwZXM6IHRydWUsXG4gICAgdXNlSmF2YVNjcmlwdDogZmFsc2UsXG4gICAgc3VwcG9ydFR3b3NsYXNoQ29tcGlsZXJPcHRpb25zOiBmYWxzZSxcbiAgICBsb2dnZXI6IHtcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcbiAgICAgIGxvZzogKCkgPT4ge30sXG4gICAgfSxcbiAgfVxuICByZXR1cm4gY29uZmlnXG59XG5cbmZ1bmN0aW9uIGRlZmF1bHRGaWxlUGF0aChjb25maWc6IFBsYXlncm91bmRDb25maWcsIGNvbXBpbGVyT3B0aW9uczogQ29tcGlsZXJPcHRpb25zLCBtb25hY286IE1vbmFjbykge1xuICBjb25zdCBpc0pTWCA9IGNvbXBpbGVyT3B0aW9ucy5qc3ggIT09IG1vbmFjby5sYW5ndWFnZXMudHlwZXNjcmlwdC5Kc3hFbWl0Lk5vbmVcbiAgY29uc3QgZmlsZUV4dCA9IGNvbmZpZy51c2VKYXZhU2NyaXB0ID8gJ2pzJyA6ICd0cydcbiAgY29uc3QgZXh0ID0gaXNKU1ggPyBmaWxlRXh0ICsgJ3gnIDogZmlsZUV4dFxuICByZXR1cm4gJ2lucHV0LicgKyBleHRcbn1cblxuLyoqIENyZWF0ZXMgYSBtb25hY28gZmlsZSByZWZlcmVuY2UsIGJhc2ljYWxseSBhIGZhbmN5IHBhdGggKi9cbmZ1bmN0aW9uIGNyZWF0ZUZpbGVVcmkoY29uZmlnOiBQbGF5Z3JvdW5kQ29uZmlnLCBjb21waWxlck9wdGlvbnM6IENvbXBpbGVyT3B0aW9ucywgbW9uYWNvOiBNb25hY28pIHtcbiAgcmV0dXJuIG1vbmFjby5VcmkuZmlsZShkZWZhdWx0RmlsZVBhdGgoY29uZmlnLCBjb21waWxlck9wdGlvbnMsIG1vbmFjbykpXG59XG5cbi8qKiBDcmVhdGVzIGEgc2FuZGJveCBlZGl0b3IsIGFuZCByZXR1cm5zIGEgc2V0IG9mIHVzZWZ1bCBmdW5jdGlvbnMgYW5kIHRoZSBlZGl0b3IgKi9cbmV4cG9ydCBjb25zdCBjcmVhdGVUeXBlU2NyaXB0U2FuZGJveCA9IChcbiAgcGFydGlhbENvbmZpZzogUGFydGlhbDxQbGF5Z3JvdW5kQ29uZmlnPixcbiAgbW9uYWNvOiBNb25hY28sXG4gIHRzOiB0eXBlb2YgaW1wb3J0KCd0eXBlc2NyaXB0JylcbikgPT4ge1xuICBjb25zdCBjb25maWcgPSB7IC4uLmRlZmF1bHRQbGF5Z3JvdW5kU2V0dGluZ3MoKSwgLi4ucGFydGlhbENvbmZpZyB9XG4gIGlmICghKCdkb21JRCcgaW4gY29uZmlnKSAmJiAhKCdlbGVtZW50VG9BcHBlbmQnIGluIGNvbmZpZykpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdZb3UgZGlkIG5vdCBwcm92aWRlIGEgZG9tSUQgb3IgZWxlbWVudFRvQXBwZW5kJylcblxuICBjb25zdCBjb21waWxlckRlZmF1bHRzID0gZ2V0RGVmYXVsdFNhbmRib3hDb21waWxlck9wdGlvbnMoY29uZmlnLCBtb25hY28pXG4gIGNvbnN0IGxhbmd1YWdlID0gbGFuZ3VhZ2VUeXBlKGNvbmZpZylcbiAgY29uc3QgZmlsZVBhdGggPSBjcmVhdGVGaWxlVXJpKGNvbmZpZywgY29tcGlsZXJEZWZhdWx0cywgbW9uYWNvKVxuICBjb25zdCBlbGVtZW50ID0gJ2RvbUlEJyBpbiBjb25maWcgPyBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChjb25maWcuZG9tSUQpIDogKGNvbmZpZyBhcyBhbnkpLmVsZW1lbnRUb0FwcGVuZFxuXG4gIGNvbnN0IGRlZmF1bHRUZXh0ID0gY29uZmlnLnN1cHByZXNzQXV0b21hdGljYWxseUdldHRpbmdEZWZhdWx0VGV4dFxuICAgID8gY29uZmlnLnRleHRcbiAgICA6IGdldEluaXRpYWxDb2RlKGNvbmZpZy50ZXh0LCBkb2N1bWVudC5sb2NhdGlvbilcblxuICBjb25zdCBtb2RlbCA9IG1vbmFjby5lZGl0b3IuY3JlYXRlTW9kZWwoZGVmYXVsdFRleHQsIGxhbmd1YWdlLCBmaWxlUGF0aClcbiAgbW9uYWNvLmVkaXRvci5kZWZpbmVUaGVtZSgnc2FuZGJveCcsIHNhbmRib3hUaGVtZSlcbiAgbW9uYWNvLmVkaXRvci5kZWZpbmVUaGVtZSgnc2FuZGJveC1kYXJrJywgc2FuZGJveFRoZW1lRGFyaylcbiAgbW9uYWNvLmVkaXRvci5zZXRUaGVtZSgnc2FuZGJveCcpXG5cbiAgY29uc3QgbW9uYWNvU2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHsgbW9kZWwgfSwgc2hhcmVkRWRpdG9yT3B0aW9ucywgY29uZmlnLm1vbmFjb1NldHRpbmdzIHx8IHt9KVxuICBjb25zdCBlZGl0b3IgPSBtb25hY28uZWRpdG9yLmNyZWF0ZShlbGVtZW50LCBtb25hY29TZXR0aW5ncylcblxuICBjb25zdCBnZXRXb3JrZXIgPSBjb25maWcudXNlSmF2YVNjcmlwdFxuICAgID8gbW9uYWNvLmxhbmd1YWdlcy50eXBlc2NyaXB0LmdldEphdmFTY3JpcHRXb3JrZXJcbiAgICA6IG1vbmFjby5sYW5ndWFnZXMudHlwZXNjcmlwdC5nZXRUeXBlU2NyaXB0V29ya2VyXG5cbiAgY29uc3QgZGVmYXVsdHMgPSBjb25maWcudXNlSmF2YVNjcmlwdFxuICAgID8gbW9uYWNvLmxhbmd1YWdlcy50eXBlc2NyaXB0LmphdmFzY3JpcHREZWZhdWx0c1xuICAgIDogbW9uYWNvLmxhbmd1YWdlcy50eXBlc2NyaXB0LnR5cGVzY3JpcHREZWZhdWx0c1xuXG4gIC8vIEluIHRoZSBmdXR1cmUgaXQnZCBiZSBnb29kIHRvIGFkZCBzdXBwb3J0IGZvciBhbiAnYWRkIG1hbnkgZmlsZXMnXG4gIGNvbnN0IGFkZExpYnJhcnlUb1J1bnRpbWUgPSAoY29kZTogc3RyaW5nLCBwYXRoOiBzdHJpbmcpID0+IHtcbiAgICBkZWZhdWx0cy5hZGRFeHRyYUxpYihjb2RlLCBwYXRoKVxuICAgIGNvbmZpZy5sb2dnZXIubG9nKGBbQVRBXSBBZGRpbmcgJHtwYXRofSB0byBydW50aW1lYClcbiAgfVxuXG4gIC8vIEdyYWIgdHlwZXNcbiAgaWYgKGNvbmZpZy5hY3F1aXJlVHlwZXMpIHtcbiAgICAvLyBUYWtlIHRoZSBjb2RlIGZyb20gdGhlIGVkaXRvciByaWdodCBhd2F5XG4gICAgY29uc3QgY29kZSA9IGVkaXRvci5nZXRNb2RlbCgpIS5nZXRWYWx1ZSgpXG4gICAgZGV0ZWN0TmV3SW1wb3J0c1RvQWNxdWlyZVR5cGVGb3IoY29kZSwgYWRkTGlicmFyeVRvUnVudGltZSwgd2luZG93LmZldGNoLmJpbmQod2luZG93KSwgY29uZmlnKVxuICB9XG5cbiAgY29uc3QgZ2V0VHdvU2xhc2hDb21wbGllck9wdGlvbnMgPSBleHRyYWN0VHdvU2xhc2hDb21wbGllck9wdGlvbnModHMpXG5cbiAgLy8gVGhlbiB1cGRhdGUgaXQgd2hlbiB0aGUgbW9kZWwgY2hhbmdlcywgcGVyaGFwcyB0aGlzIGNvdWxkIGJlIGEgZGVib3VuY2VkIHBsdWdpbiBpbnN0ZWFkIGluIHRoZSBmdXR1cmU/XG4gIGVkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudCgoKSA9PiB7XG4gICAgY29uc3QgY29kZSA9IGVkaXRvci5nZXRNb2RlbCgpIS5nZXRWYWx1ZSgpXG5cbiAgICBpZiAoY29uZmlnLnN1cHBvcnRUd29zbGFzaENvbXBpbGVyT3B0aW9ucykge1xuICAgICAgY29uc3QgY29uZmlnT3B0cyA9IGdldFR3b1NsYXNoQ29tcGxpZXJPcHRpb25zKGNvZGUpXG4gICAgICB1cGRhdGVDb21waWxlclNldHRpbmdzKGNvbmZpZ09wdHMpXG4gICAgfVxuICAgIGlmIChjb25maWcuYWNxdWlyZVR5cGVzKSB7XG4gICAgICBkZXRlY3ROZXdJbXBvcnRzVG9BY3F1aXJlVHlwZUZvcihjb2RlLCBhZGRMaWJyYXJ5VG9SdW50aW1lLCB3aW5kb3cuZmV0Y2guYmluZCh3aW5kb3cpLCBjb25maWcpXG4gICAgfVxuICB9KVxuXG4gIC8vIEdyYWIgdGhlIGNvbXBpbGVyIGZsYWdzIHZpYSB0aGUgcXVlcnkgcGFyYW1zXG4gIGxldCBjb21waWxlck9wdGlvbnM6IENvbXBpbGVyT3B0aW9uc1xuICBpZiAoIWNvbmZpZy5zdXBwcmVzc0F1dG9tYXRpY2FsbHlHZXR0aW5nQ29tcGlsZXJGbGFncykge1xuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMobG9jYXRpb24uc2VhcmNoKVxuICAgIGxldCBxdWVyeVBhcmFtQ29tcGlsZXJPcHRpb25zID0gZ2V0Q29tcGlsZXJPcHRpb25zRnJvbVBhcmFtcyhjb21waWxlckRlZmF1bHRzLCBwYXJhbXMpXG4gICAgaWYgKE9iamVjdC5rZXlzKHF1ZXJ5UGFyYW1Db21waWxlck9wdGlvbnMpLmxlbmd0aClcbiAgICAgIGNvbmZpZy5sb2dnZXIubG9nKCdbQ29tcGlsZXJdIEZvdW5kIGNvbXBpbGVyIG9wdGlvbnMgaW4gcXVlcnkgcGFyYW1zOiAnLCBxdWVyeVBhcmFtQ29tcGlsZXJPcHRpb25zKVxuICAgIGNvbXBpbGVyT3B0aW9ucyA9IHsgLi4uY29tcGlsZXJEZWZhdWx0cywgLi4ucXVlcnlQYXJhbUNvbXBpbGVyT3B0aW9ucyB9XG4gIH0gZWxzZSB7XG4gICAgY29tcGlsZXJPcHRpb25zID0gY29tcGlsZXJEZWZhdWx0c1xuICB9XG5cbiAgY29uZmlnLmxvZ2dlci5sb2coJ1tDb21waWxlcl0gU2V0IGNvbXBpbGVyIG9wdGlvbnM6ICcsIGNvbXBpbGVyT3B0aW9ucylcbiAgZGVmYXVsdHMuc2V0Q29tcGlsZXJPcHRpb25zKGNvbXBpbGVyT3B0aW9ucylcblxuICAvLyBUbyBsZXQgY2xpZW50cyBwbHVnIGludG8gY29tcGlsZXIgc2V0dGluZ3MgY2hhbmdlc1xuICBsZXQgZGlkVXBkYXRlQ29tcGlsZXJTZXR0aW5ncyA9IChvcHRzOiBDb21waWxlck9wdGlvbnMpID0+IHt9XG5cbiAgY29uc3QgdXBkYXRlQ29tcGlsZXJTZXR0aW5ncyA9IChvcHRzOiBDb21waWxlck9wdGlvbnMpID0+IHtcbiAgICBjb25maWcubG9nZ2VyLmxvZygnW0NvbXBpbGVyXSBVcGRhdGluZyBjb21waWxlciBvcHRpb25zOiAnLCBvcHRzKVxuICAgIGNvbXBpbGVyT3B0aW9ucyA9IHsgLi4ub3B0cywgLi4uY29tcGlsZXJPcHRpb25zIH1cbiAgICBkZWZhdWx0cy5zZXRDb21waWxlck9wdGlvbnMoY29tcGlsZXJPcHRpb25zKVxuICAgIGRpZFVwZGF0ZUNvbXBpbGVyU2V0dGluZ3MoY29tcGlsZXJPcHRpb25zKVxuICB9XG5cbiAgY29uc3QgdXBkYXRlQ29tcGlsZXJTZXR0aW5nID0gKGtleToga2V5b2YgQ29tcGlsZXJPcHRpb25zLCB2YWx1ZTogYW55KSA9PiB7XG4gICAgY29uZmlnLmxvZ2dlci5sb2coJ1tDb21waWxlcl0gU2V0dGluZyBjb21waWxlciBvcHRpb25zICcsIGtleSwgJ3RvJywgdmFsdWUpXG4gICAgY29tcGlsZXJPcHRpb25zW2tleV0gPSB2YWx1ZVxuICAgIGRlZmF1bHRzLnNldENvbXBpbGVyT3B0aW9ucyhjb21waWxlck9wdGlvbnMpXG4gICAgZGlkVXBkYXRlQ29tcGlsZXJTZXR0aW5ncyhjb21waWxlck9wdGlvbnMpXG4gIH1cblxuICBjb25zdCBzZXRDb21waWxlclNldHRpbmdzID0gKG9wdHM6IENvbXBpbGVyT3B0aW9ucykgPT4ge1xuICAgIGNvbmZpZy5sb2dnZXIubG9nKCdbQ29tcGlsZXJdIFNldHRpbmcgY29tcGlsZXIgb3B0aW9uczogJywgb3B0cylcbiAgICBjb21waWxlck9wdGlvbnMgPSBvcHRzXG4gICAgZGVmYXVsdHMuc2V0Q29tcGlsZXJPcHRpb25zKGNvbXBpbGVyT3B0aW9ucylcbiAgICBkaWRVcGRhdGVDb21waWxlclNldHRpbmdzKGNvbXBpbGVyT3B0aW9ucylcbiAgfVxuXG4gIGNvbnN0IGdldENvbXBpbGVyT3B0aW9ucyA9ICgpID0+IHtcbiAgICByZXR1cm4gY29tcGlsZXJPcHRpb25zXG4gIH1cblxuICBjb25zdCBzZXREaWRVcGRhdGVDb21waWxlclNldHRpbmdzID0gKGZ1bmM6IChvcHRzOiBDb21waWxlck9wdGlvbnMpID0+IHZvaWQpID0+IHtcbiAgICBkaWRVcGRhdGVDb21waWxlclNldHRpbmdzID0gZnVuY1xuICB9XG5cbiAgLyoqIEdldHMgdGhlIHJlc3VsdHMgb2YgY29tcGlsaW5nIHlvdXIgZWRpdG9yJ3MgY29kZSAqL1xuICBjb25zdCBnZXRFbWl0UmVzdWx0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCkhXG5cbiAgICBjb25zdCBjbGllbnQgPSBhd2FpdCBnZXRXb3JrZXJQcm9jZXNzKClcbiAgICByZXR1cm4gYXdhaXQgY2xpZW50LmdldEVtaXRPdXRwdXQobW9kZWwudXJpLnRvU3RyaW5nKCkpXG4gIH1cblxuICAvKiogR2V0cyB0aGUgSlMgIG9mIGNvbXBpbGluZyB5b3VyIGVkaXRvcidzIGNvZGUgKi9cbiAgY29uc3QgZ2V0UnVubmFibGVKUyA9IGFzeW5jICgpID0+IHtcbiAgICBpZiAoY29uZmlnLnVzZUphdmFTY3JpcHQpIHtcbiAgICAgIHJldHVybiBnZXRUZXh0KClcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBnZXRFbWl0UmVzdWx0KClcbiAgICBjb25zdCBmaXJzdEpTID0gcmVzdWx0Lm91dHB1dEZpbGVzLmZpbmQoKG86IGFueSkgPT4gby5uYW1lLmVuZHNXaXRoKCcuanMnKSB8fCBvLm5hbWUuZW5kc1dpdGgoJy5qc3gnKSlcbiAgICByZXR1cm4gKGZpcnN0SlMgJiYgZmlyc3RKUy50ZXh0KSB8fCAnJ1xuICB9XG5cbiAgLyoqIEdldHMgdGhlIERUUyBmb3IgdGhlIEpTL1RTICBvZiBjb21waWxpbmcgeW91ciBlZGl0b3IncyBjb2RlICovXG4gIGNvbnN0IGdldERUU0ZvckNvZGUgPSBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZ2V0RW1pdFJlc3VsdCgpXG4gICAgcmV0dXJuIHJlc3VsdC5vdXRwdXRGaWxlcy5maW5kKChvOiBhbnkpID0+IG8ubmFtZS5lbmRzV2l0aCgnLmQudHMnKSkhLnRleHRcbiAgfVxuXG4gIGNvbnN0IGdldFdvcmtlclByb2Nlc3MgPSBhc3luYyAoKTogUHJvbWlzZTxUeXBlU2NyaXB0V29ya2VyPiA9PiB7XG4gICAgY29uc3Qgd29ya2VyID0gYXdhaXQgZ2V0V29ya2VyKClcbiAgICByZXR1cm4gYXdhaXQgd29ya2VyKG1vZGVsLnVyaSlcbiAgfVxuXG4gIGNvbnN0IGdldERvbU5vZGUgPSAoKSA9PiBlZGl0b3IuZ2V0RG9tTm9kZSgpIVxuICBjb25zdCBnZXRNb2RlbCA9ICgpID0+IGVkaXRvci5nZXRNb2RlbCgpIVxuICBjb25zdCBnZXRUZXh0ID0gKCkgPT4gZ2V0TW9kZWwoKS5nZXRWYWx1ZSgpXG4gIGNvbnN0IHNldFRleHQgPSAodGV4dDogc3RyaW5nKSA9PiBnZXRNb2RlbCgpLnNldFZhbHVlKHRleHQpXG5cbiAgLyoqXG4gICAqIFdhcm5pbmc6IFJ1bnMgb24gdGhlIG1haW4gdGhyZWFkXG4gICAqL1xuICBjb25zdCBjcmVhdGVUU1Byb2dyYW0gPSBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgZnNNYXAgPSBhd2FpdCB0c3Zmcy5jcmVhdGVEZWZhdWx0TWFwRnJvbUNETihjb21waWxlck9wdGlvbnMsIHRzLnZlcnNpb24sIHRydWUsIHRzLCBsenN0cmluZylcbiAgICBmc01hcC5zZXQoZmlsZVBhdGgucGF0aCwgZ2V0VGV4dCgpKVxuXG4gICAgY29uc3Qgc3lzdGVtID0gdHN2ZnMuY3JlYXRlU3lzdGVtKGZzTWFwKVxuICAgIGNvbnN0IGhvc3QgPSB0c3Zmcy5jcmVhdGVWaXJ0dWFsQ29tcGlsZXJIb3N0KHN5c3RlbSwgY29tcGlsZXJPcHRpb25zLCB0cylcblxuICAgIGNvbnN0IHByb2dyYW0gPSB0cy5jcmVhdGVQcm9ncmFtKHtcbiAgICAgIHJvb3ROYW1lczogWy4uLmZzTWFwLmtleXMoKV0sXG4gICAgICBvcHRpb25zOiBjb21waWxlck9wdGlvbnMsXG4gICAgICBob3N0OiBob3N0LmNvbXBpbGVySG9zdCxcbiAgICB9KVxuXG4gICAgcmV0dXJuIHByb2dyYW1cbiAgfVxuXG4gIGNvbnN0IGdldEFTVCA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBwcm9ncmFtID0gYXdhaXQgY3JlYXRlVFNQcm9ncmFtKClcbiAgICBwcm9ncmFtLmVtaXQoKVxuICAgIHJldHVybiBwcm9ncmFtLmdldFNvdXJjZUZpbGUoZmlsZVBhdGgucGF0aCkhXG4gIH1cblxuICAvLyBQYXNzIGFsb25nIHRoZSBzdXBwb3J0ZWQgcmVsZWFzZXMgZm9yIHRoZSBwbGF5Z3JvdW5kXG4gIGNvbnN0IHN1cHBvcnRlZFZlcnNpb25zID0gc3VwcG9ydGVkUmVsZWFzZXNcblxuICByZXR1cm4ge1xuICAgIC8qKiBUaGUgc2FtZSBjb25maWcgeW91IHBhc3NlZCBpbiAqL1xuICAgIGNvbmZpZyxcbiAgICAvKiogQSBsaXN0IG9mIFR5cGVTY3JpcHQgdmVyc2lvbnMgeW91IGNhbiB1c2Ugd2l0aCB0aGUgVHlwZVNjcmlwdCBzYW5kYm94ICovXG4gICAgc3VwcG9ydGVkVmVyc2lvbnMsXG4gICAgLyoqIFRoZSBtb25hY28gZWRpdG9yIGluc3RhbmNlICovXG4gICAgZWRpdG9yLFxuICAgIC8qKiBFaXRoZXIgXCJ0eXBlc2NyaXB0XCIgb3IgXCJqYXZhc2NyaXB0XCIgZGVwZW5kaW5nIG9uIHlvdXIgY29uZmlnICovXG4gICAgbGFuZ3VhZ2UsXG4gICAgLyoqIFRoZSBvdXRlciBtb25hY28gbW9kdWxlLCB0aGUgcmVzdWx0IG9mIHJlcXVpcmUoXCJtb25hY28tZWRpdG9yXCIpICAqL1xuICAgIG1vbmFjbyxcbiAgICAvKiogR2V0cyBhIG1vbmFjby10eXBlc2NyaXB0IHdvcmtlciwgdGhpcyB3aWxsIGdpdmUgeW91IGFjY2VzcyB0byBhIGxhbmd1YWdlIHNlcnZlci4gTm90ZTogcHJlZmVyIHRoaXMgZm9yIGxhbmd1YWdlIHNlcnZlciB3b3JrIGJlY2F1c2UgaXQgaGFwcGVucyBvbiBhIHdlYndvcmtlciAuICovXG4gICAgZ2V0V29ya2VyUHJvY2VzcyxcbiAgICAvKiogQSBjb3B5IG9mIHJlcXVpcmUoXCJ0eXBlc2NyaXB0LXZmc1wiKSB0aGlzIGNhbiBiZSB1c2VkIHRvIHF1aWNrbHkgc2V0IHVwIGFuIGluLW1lbW9yeSBjb21waWxlciBydW5zIGZvciBBU1RzLCBvciB0byBnZXQgY29tcGxleCBsYW5ndWFnZSBzZXJ2ZXIgcmVzdWx0cyAoYW55dGhpbmcgYWJvdmUgaGFzIHRvIGJlIHNlcmlhbGl6ZWQgd2hlbiBwYXNzZWQpKi9cbiAgICB0c3ZmcyxcbiAgICAvKiogR2V0IGFsbCB0aGUgZGlmZmVyZW50IGVtaXR0ZWQgZmlsZXMgYWZ0ZXIgVHlwZVNjcmlwdCBpcyBydW4gKi9cbiAgICBnZXRFbWl0UmVzdWx0LFxuICAgIC8qKiBHZXRzIGp1c3QgdGhlIEphdmFTY3JpcHQgZm9yIHlvdXIgc2FuZGJveCwgd2lsbCB0cmFuc3BpbGUgaWYgaW4gVFMgb25seSAqL1xuICAgIGdldFJ1bm5hYmxlSlMsXG4gICAgLyoqIEdldHMgdGhlIERUUyBvdXRwdXQgb2YgdGhlIG1haW4gY29kZSBpbiB0aGUgZWRpdG9yICovXG4gICAgZ2V0RFRTRm9yQ29kZSxcbiAgICAvKiogVGhlIG1vbmFjby1lZGl0b3IgZG9tIG5vZGUsIHVzZWQgZm9yIHNob3dpbmcvaGlkaW5nIHRoZSBlZGl0b3IgKi9cbiAgICBnZXREb21Ob2RlLFxuICAgIC8qKiBUaGUgbW9kZWwgaXMgYW4gb2JqZWN0IHdoaWNoIG1vbmFjbyB1c2VzIHRvIGtlZXAgdHJhY2sgb2YgdGV4dCBpbiB0aGUgZWRpdG9yLiBVc2UgdGhpcyB0byBkaXJlY3RseSBtb2RpZnkgdGhlIHRleHQgaW4gdGhlIGVkaXRvciAqL1xuICAgIGdldE1vZGVsLFxuICAgIC8qKiBHZXRzIHRoZSB0ZXh0IG9mIHRoZSBtYWluIG1vZGVsLCB3aGljaCBpcyB0aGUgdGV4dCBpbiB0aGUgZWRpdG9yICovXG4gICAgZ2V0VGV4dCxcbiAgICAvKiogU2hvcnRjdXQgZm9yIHNldHRpbmcgdGhlIG1vZGVsJ3MgdGV4dCBjb250ZW50IHdoaWNoIHdvdWxkIHVwZGF0ZSB0aGUgZWRpdG9yICovXG4gICAgc2V0VGV4dCxcbiAgICAvKiogV0lQOiBHZXRzIHRoZSBBU1Qgb2YgdGhlIGN1cnJlbnQgdGV4dCAqL1xuICAgIGdldEFTVCxcbiAgICAvKiogVGhlIG1vZHVsZSB5b3UgZ2V0IGZyb20gIHJlcXVpcmUoXCJ0eXBlc2NyaXB0XCIpICovXG4gICAgdHMsXG4gICAgLyoqIENyZWF0ZSBhIG5ldyBQcm9ncmFtLCBhIFR5cGVTY3JpcHQgZGF0YSBtb2RlbCB3aGljaCByZXByZXNlbnRzIHRoZSBlbnRpcmUgcHJvamVjdC5cbiAgICAgKlxuICAgICAqIFRoZSBmaXJzdCB0aW1lIHRoaXMgaXMgY2FsbGVkIGl0IGhhcyB0byBkb3dubG9hZCBhbGwgdGhlIERUUyBmaWxlcyB3aGljaCBpcyBuZWVkZWQgZm9yIGFuIGV4YWN0IGNvbXBpbGVyIHJ1bi4gV2hpY2hcbiAgICAgKiBhdCBtYXggaXMgYWJvdXQgMS41TUIgLSBhZnRlciB0aGF0IHN1YnNlcXVlbnQgZG93bmxvYWRzIG9mIGR0cyBsaWIgZmlsZXMgY29tZSBmcm9tIGxvY2FsU3RvcmFnZS5cbiAgICAgKlxuICAgICAqIFlvdSBwcm9iYWJseSB3YW50XG4gICAgICovXG4gICAgY3JlYXRlVFNQcm9ncmFtLFxuICAgIC8qKiBUaGUgU2FuZGJveCdzIGRlZmF1bHQgY29tcGlsZXIgb3B0aW9ucyAgKi9cbiAgICBjb21waWxlckRlZmF1bHRzLFxuICAgIC8qKiBUaGUgU2FuZGJveCdzIGN1cnJlbnQgY29tcGlsZXIgb3B0aW9ucyAqL1xuICAgIGdldENvbXBpbGVyT3B0aW9ucyxcbiAgICAvKiogUmVwbGFjZSB0aGUgU2FuZGJveCdzIGNvbXBpbGVyIG9wdGlvbnMgKi9cbiAgICBzZXRDb21waWxlclNldHRpbmdzLFxuICAgIC8qKiBPdmVyd3JpdGUgdGhlIFNhbmRib3gncyBjb21waWxlciBvcHRpb25zICovXG4gICAgdXBkYXRlQ29tcGlsZXJTZXR0aW5nLFxuICAgIC8qKiBVcGRhdGUgYSBzaW5nbGUgY29tcGlsZXIgb3B0aW9uIGluIHRoZSBTQW5kYm94ICovXG4gICAgdXBkYXRlQ29tcGlsZXJTZXR0aW5ncyxcbiAgICAvKiogQSB3YXkgdG8gZ2V0IGNhbGxiYWNrcyB3aGVuIGNvbXBpbGVyIHNldHRpbmdzIGhhdmUgY2hhbmdlZCAqL1xuICAgIHNldERpZFVwZGF0ZUNvbXBpbGVyU2V0dGluZ3MsXG4gICAgLyoqIEEgY29weSBvZiBsenN0cmluZywgd2hpY2ggaXMgdXNlZCB0byBhcmNoaXZlL3VuYXJjaGl2ZSBjb2RlICovXG4gICAgbHpzdHJpbmcsXG4gICAgLyoqIFJldHVybnMgY29tcGlsZXIgb3B0aW9ucyBmb3VuZCBpbiB0aGUgcGFyYW1zIG9mIHRoZSBjdXJyZW50IHBhZ2UgKi9cbiAgICBnZXRVUkxRdWVyeVdpdGhDb21waWxlck9wdGlvbnMsXG4gICAgLyoqIFJldHVybnMgY29tcGlsZXIgb3B0aW9ucyBpbiB0aGUgc291cmNlIGNvZGUgdXNpbmcgdHdvc2xhc2ggbm90YXRpb24gKi9cbiAgICBnZXRUd29TbGFzaENvbXBsaWVyT3B0aW9ucyxcbiAgICAvKiogR2V0cyB0byB0aGUgY3VycmVudCBtb25hY28tbGFuZ3VhZ2UsIHRoaXMgaXMgaG93IHlvdSB0YWxrIHRvIHRoZSBiYWNrZ3JvdW5kIHdlYndvcmtlcnMgKi9cbiAgICBsYW5ndWFnZVNlcnZpY2VEZWZhdWx0czogZGVmYXVsdHMsXG4gIH1cbn1cbiJdfQ==