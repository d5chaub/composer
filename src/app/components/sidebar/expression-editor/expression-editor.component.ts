import {Component, ElementRef, ViewChild, OnInit, OnDestroy} from "@angular/core";
import {ExpressionEditor} from "./expression-editor";
import {ExpressionEditorData} from "../../../models/expression-editor-data.model";
import {SandboxService, SandboxResponse} from "../../../services/sandbox/sandbox.service";
import {Subscription} from "rxjs/Subscription";
import {Subject} from "rxjs/Subject";
import {ExpressionModel} from "cwlts/models/d2sb";
import {ExpressionSidebarService} from "../../../services/sidebars/expression-sidebar.service";
import {Subject, Observable} from "rxjs";
import {Expression} from "cwlts/mappings/d2sb/Expression";
import Document = AceAjax.Document;
import IEditSession = AceAjax.IEditSession;
import TextMode = AceAjax.TextMode;

require("./expression-editor.component.scss");

@Component({
    selector: "expression-editor",
    host: {
        class: "block"
    },
    template: `
         <div class="expression-editor-component">
                <div class="expression-editor-header">
                
                    <span class="expression-head-text">
                        Argument value expression
                        <i class="fa fa-info-circle help-icon"></i>
                    </span>
                    
                    <span class="expression-buttons-container">
                        <button type="button"
                            class="btn btn-sm btn-outline-secondary"
                            (click)="cancel()">Cancel</button>
                        
                        <button type="button" 
                            class="btn btn-sm btn-success"
                            (click)="save()">Save</button>
                    </span>
                </div>
                
                <div #ace class="ace-editor"></div>
                
                <div class="expression-result-container">
                    <div class="code-preview">
                        Code preview
                    </div>
                    
                    <div class="expression-result-value">
                       {{evaluatedExpression}}
                    </div>
                   
                    <div class="expression-result-overlay">
                        <div class="execute-button-container">
                            <button type="button" 
                                    class="btn btn-sm btn-outline-secondary execute-button"
                                    (click)="evaluateExpression()"><i class="fa fa-refresh"></i> Update</button>
                        </div>
                    </div>
                   
                   
                </div>
         </div>
 `
})
export class ExpressionEditorComponent implements OnInit, OnDestroy {

    /** Expression coming form the tool */
    private initialExpressionScript: string;

    /** Evaluated expressions */
    private newValueStream: Subject<string | ExpressionModel>;

    /** Reference to the element in which we want to instantiate the Ace editor */
    @ViewChild("ace")
    private aceContainer: ElementRef;

    private editor: ExpressionEditor;

    /** Global context in which expression should be evaluated */
    private context: any;

    /** Code String that we send to the sandbox */
    private codeToEvaluate: string;

    /** String we display as the result */
    private evaluatedExpression: string;

    private sandboxService: SandboxService;

    private subs: Subscription[];

    private sandBoxSub: Subscription;

    constructor(private expressionSidebarService: ExpressionSidebarService) {
        this.subs = [];
    }

    ngOnInit(): void {
        this.sandboxService = new SandboxService();

        this.subs.push(
            this.expressionSidebarService.expressionDataStream
                .mergeMap((data:ExpressionEditorData) => {
                    this.codeToEvaluate = "";
                    this.evaluatedExpression = "";
                    this.initialExpressionScript = "";
                    this.context = data.context;

                    if ((<Expression>data.expression.serialize()).script) {
                        this.initialExpressionScript = data.expression.getExpressionScript();
                    }

                    this.newValueStream = data.newExpressionChange;
                    this.editor         = new ExpressionEditor(ace.edit(this.aceContainer.nativeElement), this.initialExpressionScript);
                    this.codeToEvaluate = this.initialExpressionScript;

                    return this.editor.expressionChanges;
                })
                .subscribe(expression => {
                    this.codeToEvaluate = expression;
                })
        );
    }

    private evaluateExpression(): Observable<SandboxResponse> {
        this.removeSandboxSub();
        let responseResult: Subject<SandboxResponse> = new Subject<SandboxResponse>();

        this.sandBoxSub = this.sandboxService.submit(this.codeToEvaluate, this.context)
            .subscribe((result: SandboxResponse) => {
                if (result.error) {
                    //TODO: make error message nicer on the UI
                    this.evaluatedExpression = result.error;
                } else {
                    this.evaluatedExpression = result.output;
                }

                responseResult.next(result);
            });

        return responseResult;
    }

    private cancel(): void {
        this.editor.setText(this.initialExpressionScript);
        this.codeToEvaluate = this.initialExpressionScript;
        this.expressionSidebarService.closeExpressionEditor();
    }

    private save(): void {
        this.evaluateExpression()
            .subscribe((result: SandboxResponse) => {
                const newExpression: ExpressionModel = new ExpressionModel(undefined);

                if (result.error) {
                    newExpression.setValueToExpression(this.codeToEvaluate);
                } else {
                    if (result === undefined) {
                        newExpression.setValueToString("");
                    } else {
                        newExpression.setValueToExpression(this.codeToEvaluate);
                    }
                }

                this.newValueStream.next(newExpression);
            });
    }

    private removeSandboxSub(): void {
        if (this.sandBoxSub) {
            this.sandBoxSub.unsubscribe();
            this.sandBoxSub = undefined;
        }
    }

    ngOnDestroy(): void {
        if (this.editor) {
            this.editor.dispose();
        }

        this.removeSandboxSub();
        this.subs.forEach(sub => sub.unsubscribe());
    }
}

//@todo remove update button when expression is evaluated
//@todo add update button when expression is changed
//@todo evaluate expression in input field, populate result before expression editor is loaded
