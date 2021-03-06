import {Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit,style, animate, transition, trigger} from '@angular/core';
import {Http} from "@angular/http";
import {IndicatorGroupService, IndicatorGroup} from "../shared/services/indicator-group.service";
import {DatasetService, Dataset} from "../shared/services/dataset.service";
import {DataElementGroupService, DataElementGroup} from "../shared/services/data-element-group.service";
import {ScoreCard, ScorecardService} from "../shared/services/scorecard.service";
import {Router} from "@angular/router";
import {$} from "protractor";
import {ProgramIndicatorsService, ProgramIndicatorGroups} from "../shared/services/program-indicators.service";
import {EventData, EventDataService} from "../shared/services/event-data.service";
import {throttleTime} from "rxjs/operator/throttleTime";

@Component({
  selector: 'app-create',
  templateUrl: './create.component.html',
  styleUrls: ['./create.component.css'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [   // :enter is alias to 'void => *'
        style({opacity:0}),
        animate(600, style({opacity:1}))
      ]),
      transition(':leave', [   // :leave is alias to '* => void'
        animate(500, style({opacity:0}))
      ])
    ])
  ]
})
export class CreateComponent implements OnInit, AfterViewInit, OnDestroy {

  // variable initializations
  datasets: Dataset[];
  indicatorGroups: IndicatorGroup[];
  dataElementGroups: DataElementGroup[];
  programs: ProgramIndicatorGroups[];
  events: EventData[];
  current_groups: any[];
  current_listing: any[];
  activeGroup: string = null;
  done_loading_groups: boolean = false;
  done_loading_list: boolean = false;
  error_loading_groups: any = {occurred:false, message: ""};
  error_loading_list: any = {occurred:false, message: ""};
  scorecard: ScoreCard;
  listReady:boolean = false;
  listQuery: string = null;
  groupQuery: string = null;
  need_for_group: boolean = false;
  need_for_indicator: boolean = false;
  current_group_id: number = 1;
  current_holder_group_id: number = 1;
  current_indicator_holder: any;
  current_holder_group: any;
  saving_scorecard: boolean = false;
  saving_error: boolean = false;
  deleting: boolean[] = [];
  someErrorOccured: boolean = false;

  @ViewChild('title')
  title_element:ElementRef;

  @ViewChild('description')
  discription_element:ElementRef;

  dataset_types = [
    {id:'', name: "Reporting Rate"},
    {id:'.REPORTING_RATE_ON_TIME', name: "Reporting Rate on time"},
    {id:'.ACTUAL_REPORTS', name: "Actual Reports Submitted"},
    {id:'.ACTUAL_REPORTS_ON_TIME', name: "Reports Submitted on time"},
    {id:'.EXPECTED_REPORTS', name: "Expected Reports"}
  ];
  show_editor:boolean = false;
  editor;

  newLabel: string = "";

  show_bottleneck_indicators:boolean = false;
  bottleneck_card: any = {};
  constructor(private http: Http,
              private indicatorService: IndicatorGroupService,
              private datasetService: DatasetService,
              private dataElementService: DataElementGroupService,
              private router: Router,
              private scorecardService: ScorecardService,
              private programService: ProgramIndicatorsService,
              private eventService: EventDataService
  )
  {
    this.indicatorGroups = [];
    this.dataElementGroups = [];
    this.programs = [];
    this.events = [];
    this.datasets = [];
    this.current_groups = [];
    this.current_listing = [];
    // initialize the scorecard with a uid
    this.scorecard = this.getEmptyScoreCard();
    // this.getItemsFromGroups();
    this.current_indicator_holder = {
      "holder_id": this.getStartingIndicatorId(),
      "indicators": []
    };
    this.current_holder_group = {
      "id": this.getStartingGroupHolderId(),
      "name": "Default",
      "indicator_holder_ids": [],
      "background_color": "#ffffff",
      "holder_style": null
    };
  }

  ngOnInit() {
    //get indicatorGroups
    this.indicatorService.loadAll().subscribe(
      indicatorGroups => {
        for ( let group of indicatorGroups.indicatorGroups ) {
          this.indicatorGroups.push({
            id: group.id,
            name: group.name,
            indicators: []
          });
        }
        this.current_groups = this.indicatorGroups;
        this.bottleneck_card.current_groups = this.indicatorGroups;
        this.bottleneck_card.indicator = {};
        this.bottleneck_card.indicator_ready = false;
        this.error_loading_groups.occurred = false;
        this.done_loading_groups = true;
        this.bottleneck_card.done_loading_groups = true;
        this.load_list(this.current_groups[0].id, 'indicators')
        this.load_bottleneck_card_list(this.bottleneck_card.current_groups[0].id, 'indicators')
      },
      error => {
        this.error_loading_groups.occurred = true;
        this.error_loading_groups.message = "There was an error when loading Indicator Groups";
      }
    );
    //get dataElementsGroups
    this.dataElementService.loadAll().subscribe(
      dataElementGroups => {
        for ( let group of dataElementGroups.dataElementGroups ) {
          this.dataElementGroups.push({
            id: group.id,
            name: group.name,
            dataElements: []
          });
        }
      },
      error => {
        this.error_loading_groups.occurred = true;
        this.error_loading_groups.message = "There was an error when loading Data Element Groups";
      }
    );
    //get Programs
    this.programService.loadAll().subscribe(
      programs => {
        for ( let group of programs.programs ) {
          this.programs.push({
            id: group.id,
            name: group.name,
            indicators: []
          });
          this.events.push({
            id: group.id,
            name: group.name,
            indicators: []
          });
        }
      },
      error => {
        this.error_loading_groups.occurred = true;
        this.error_loading_groups.message = "There was an error when loading Programs";
      }
    );
    //get datasets
    this.datasetService.loadAll().subscribe(
      dataSets => {
        //noinspection TypeScriptUnresolvedVariable
        for ( let dataset of dataSets.dataSets ) {
          this.datasets.push({
            id: dataset.id,
            name: dataset.name,
            periodType: dataset.periodType
          });
        }
      },
      error => {
        this.error_loading_groups.occurred = true;
        this.error_loading_groups.message = "There was an error when loading Data sets";
      }
    );
  }

  ngAfterViewInit(){
    this.title_element.nativeElement.focus();
    tinymce.init({
      selector: '#my-editor-id',
      height: 200,
      plugins: ['link', 'paste', 'table','image', 'code'],
      skin_url: 'assets/skins/lightgray',
      setup: editor => {
        this.editor = editor;
        editor.on('keyup', () => {
          // const content = editor.getContent();
          // this.keyupHandlerFunction(content);
        });
        editor.on('change', () => {
          const content = editor.getContent();
          this.scorecard.data.header.template.content = content;
        });
      },
    });
  }
  // cancel scorecard creation process
  cancelCreate(){
    this.router.navigateByUrl('');
  }
  // deal with all issues during group type switching between dataelent, indicators and datasets
  switchType(current_type): void{
    this.listReady = false;
    this.groupQuery = null;
    if(current_type == "indicators"){
      this.current_groups = this.indicatorGroups;
      if(this.current_groups.length != 0){
        this.load_list(this.current_groups[0].id, current_type)
      }
    }else if(current_type == "dataElements"){
      this.current_groups = this.dataElementGroups;
      if(this.current_groups.length != 0){
        this.load_list(this.current_groups[0].id, current_type)
      }
    }else if(current_type == "datasets"){
      this.current_groups = this.dataset_types;
      if(this.current_groups.length != 0){
        this.load_list(this.current_groups[0].id, current_type)
      }
    }else if(current_type == "programs"){
      this.current_groups = this.programs;
      if(this.current_groups.length != 0){
        this.load_list(this.current_groups[0].id, current_type)
      }
    }else if(current_type == "event"){
      this.current_groups = this.programs;
      if(this.current_groups.length != 0){
        this.load_list(this.current_groups[0].id, current_type)
      }
    }else{

    }

  }

  // load items to be displayed in a list of indicators/ data Elements / Data Sets
  load_list(group_id,current_type): void{
    this.listQuery = null;
    this.activeGroup = group_id;
    this.listReady = true;
    this.current_listing = [];
    this.done_loading_list = false;
    if( current_type == "indicators" ){
      let load_new = false;
      for ( let group  of this.indicatorGroups ){
        if ( group.id == group_id ){
          if (group.indicators.length != 0){
            this.current_listing = group.indicators;
            this.done_loading_list = true;
          }else{
            load_new = true;
          }
        }
      }
      if ( load_new ){
        this.indicatorService.load(group_id).subscribe(
          indicators => {
            this.current_listing = indicators.indicators;
            this.done_loading_list = true;
            for ( let group  of this.indicatorGroups ){
              if ( group.id == group_id ){
                group.indicators = indicators.indicators;
              }
            }
          },
          error => {
            this.error_loading_list.occurred = true;
            this.error_loading_list.message = "Something went wrong when trying to load Indicators";
          }
        )
      }

    }
    else if( current_type == "dataElements" ){
      let load_new = false;
      for ( let group  of this.dataElementGroups ){
        if ( group.id == group_id ){
          if (group.dataElements.length != 0){
            this.current_listing = group.dataElements;
            this.done_loading_list = true;
          }else{
            load_new = true;
          }
        }
      }
      if ( load_new ) {
        this.dataElementService.load(group_id).subscribe(
          dataElements => {
            this.current_listing = dataElements.dataElements;
            this.done_loading_list = true;
            for ( let group  of this.dataElementGroups ){
              if ( group.id == group_id ){
                group.dataElements = dataElements.dataElements;
              }
            }
          },
          error => {
            this.error_loading_list.occurred = true;
            this.error_loading_list.message = "Something went wrong when trying to load Indicators";
          }
        )
      }
    }
    else if( current_type == "datasets" ){
      this.current_listing = [];
      let group_name = "";
      for (let dataset_group of this.dataset_types ){
        if(dataset_group.id == group_id){
          group_name = dataset_group.name;
        }
      }
      for( let dataset of this.datasets ){
        this.current_listing.push(
          {id:dataset.id+group_id, name: group_name+" "+dataset.name}
        )
      }
      this.listReady = true;
      this.done_loading_list = true;
      this.listQuery = null;
    }
    else if( current_type == "programs" ){
      let load_new = false;
      for ( let group  of this.programs ){
        if ( group.id == group_id ){
          if (group.indicators.length != 0){
            this.current_listing = group.indicators;
            this.done_loading_list = true;
          }else{
            load_new = true;
          }
        }
      }
      if ( load_new ){
        this.programService.load(group_id).subscribe(
          indicators => {
            this.current_listing = indicators.programs[0].programIndicators;
            this.done_loading_list = true;
            for ( let group  of this.programs ){
              if ( group.id == group_id ){
                group.indicators = indicators.programs.programIndicators;
              }
            }
          },
          error => {
            this.error_loading_list.occurred = true;
            this.error_loading_list.message = "Something went wrong when trying to load Indicators";
          }
        )
      }

    }
    else if( current_type == "event" ){
      let load_new = false;
      for ( let group  of this.events ){
        if ( group.id == group_id ){
          if (group.indicators.length != 0){
            this.current_listing = group.indicators;
            this.done_loading_list = true;
          }else{
            load_new = true;
          }
        }
      }
      if ( load_new ){
        this.eventService.load(group_id).subscribe(
          indicators => {
            //noinspection TypeScriptUnresolvedVariable
            for (let event_data of indicators.programDataElements ){
              if(event_data.valueType == "INTEGER_ZERO_OR_POSITIVE" || event_data.valueType == "BOOLEAN" ){
                this.current_listing.push(event_data)
              }
            }
            this.done_loading_list = true;
            for ( let group  of this.events ){
              if ( group.id == group_id ){
                group.indicators = this.current_listing;
              }
            }
          },
          error => {
            this.error_loading_list.occurred = true;
            this.error_loading_list.message = "Something went wrong when trying to load Indicators";
          }
        )
      }

    }
    else{

    }
  }

  // load a single item for use in a score card
  load_item(item): void{

    if( this.indicatorExist( this.scorecard.data.data_settings.indicator_holders, item )){
      // TODO: Implement a popup to tell a user that this has already been added
    }else{
      let indicator = this.getIndicatorStructure(item.name, item.id);
      indicator.value = Math.floor(Math.random() * 60) + 40;
      // ensure indicator has all additinal labels
      for (let label of this.scorecard.data.additional_labels ){
        indicator.additional_label_values[label] = "";
      }
      // this.current_indicator_holder.holder_id = this.current_group_id;
      if(this.current_indicator_holder.indicators.length < 2){
        this.current_indicator_holder.indicators.push( indicator );
      }else{
        this.current_group_id = this.getStartingIndicatorId() + 1;
        this.current_indicator_holder = {
          "holder_id": this.current_group_id,
          "indicators": []
        };
        this.current_indicator_holder.indicators.push( indicator );
        this.need_for_indicator = false;
        this.cleanUpEmptyColumns();
      }
      this.addIndicatorHolder(this.current_indicator_holder);
      this.current_holder_group.id = this.current_holder_group_id;
      this.addHolderGroups(this.current_holder_group, this.current_indicator_holder);
    }

  }

  // add an indicator holder to a scorecard
  addIndicatorHolder(indicator_holder): void{
    let add_new = true;
    for( let holder of this.scorecard.data.data_settings.indicator_holders ){
      if (holder.holder_id == indicator_holder.holder_id){
        holder = indicator_holder;
        add_new = false;
      }
    }
    if(add_new){
      this.scorecard.data.data_settings.indicator_holders.push(indicator_holder);
    }
    this.need_for_indicator = true;
  }

  // add a group of holders to a scorecard
  addHolderGroups(holder_group,holder): void{
    this.need_for_group = true;
    let add_new = true;
    for( let group of this.scorecard.data.data_settings.indicator_holder_groups ){
      if (group.id == holder_group.id){
        if( group.indicator_holder_ids.indexOf(holder.holder_id) == -1 ){
          group.indicator_holder_ids.push(holder.holder_id);
        }
        add_new = false;
      }
    }
    if(add_new){
      this.deleting[holder_group.id] = false;
      if( holder_group.indicator_holder_ids.indexOf(holder.holder_id) == -1 ) holder_group.indicator_holder_ids.push(holder.holder_id);
      this.scorecard.data.data_settings.indicator_holder_groups.push(holder_group);
    }
  }

  // enabling creating of group
  createGroup(): void {
    this.current_holder_group_id = this.scorecard.data.data_settings.indicator_holders.length + 1;
    this.current_holder_group = {
      "id": this.current_holder_group_id,
      "name": "New Group",
      "indicator_holder_ids": [],
      "background_color": "#ffffff",
      "holder_style": null
    };
    this.enableAddIndicator();
  }

  // enable adding of new Indicator
  enableAddIndicator(): void{
    this.current_group_id = this.getStartingIndicatorId() + 1;
    this.current_indicator_holder = {
      "holder_id": this.current_group_id,
      "indicators": []
    };
    this.need_for_indicator = false;
    this.cleanUpEmptyColumns();

    this.addIndicatorHolder(this.current_indicator_holder);
    this.current_holder_group.id = this.current_holder_group_id;
    this.addHolderGroups(this.current_holder_group, this.current_indicator_holder);
  }

  //try to deduce last number needed to start adding indicator
  getStartingIndicatorId(): number{
    let last_id = 1;
    for(let holder of this.scorecard.data.data_settings.indicator_holders){
      if( holder.holder_id > last_id){
        last_id = holder.holder_id;
      }
    }
    return last_id;
  }

  //try to deduce last number needed to start adding holder group
  getStartingGroupHolderId(): number{
    let last_id = 1;
    for(let group of this.scorecard.data.data_settings.indicator_holder_groups){
      if( group.id > last_id){
        last_id = group.id;
      }
    }
    return last_id;
  }

  //pass through the scorecard and delete all empty rows
  cleanUpEmptyColumns(){
    let deleted_id = null;
    this.scorecard.data.data_settings.indicator_holders.forEach((item, index) => {
      if(item.indicators.length == 0){
        deleted_id = item.holder_id;
        this.scorecard.data.data_settings.indicator_holders.splice(index,1);
      }
    });
    this.scorecard.data.data_settings.indicator_holder_groups.forEach( (group, groupIndex)=>{
      group.indicator_holder_ids.forEach((item, index) => {
        if(item == deleted_id){
          group.indicator_holder_ids.splice(index,1);
        }
        if(group.indicator_holder_ids.length == 0){
          this.scorecard.data.data_settings.indicator_holder_groups.splice(groupIndex,1);
        }
      })
    });
  }

  //function to remove the indicator holder group form the scorecard
  deleteGroup(holderGroup){
    for( let holder of holderGroup.indicator_holder_ids ){
      this.scorecard.data.data_settings.indicator_holders.forEach((item, index)=>{
        if(item.holder_id == holder){
          this.scorecard.data.data_settings.indicator_holders.splice(index,1);
        }
      })
    }
    this.scorecard.data.data_settings.indicator_holder_groups.forEach((item, index)=>{
      if(item.id == holderGroup.id){
        this.scorecard.data.data_settings.indicator_holder_groups.splice(index,1);
      }
    })
  }

  // this will enable updating of indicator
  updateIndicator(indicator:any): void{
    this.current_indicator_holder = indicator;
    this.need_for_indicator = true;
    this.scorecard.data.data_settings.indicator_holder_groups.forEach( (group, groupIndex) => {
      if(group.indicator_holder_ids.indexOf(indicator.holder_id) > -1){
        this.current_holder_group = group;
        this.current_holder_group_id = group.id;
      }
    });
    this.cleanUpEmptyColumns();
  }

  //deleting indicator from score card
  deleteIndicator(indicator): void{
    this.current_indicator_holder.indicators.forEach((item, index) => {
      if (item.id == indicator.id){
        this.current_indicator_holder.indicators.splice(index,1);
      }
    });
    this.cleanUpEmptyColumns();
  }

  // generate a random list of Id for use as scorecard id
  makeid(): string{
    let text = "";
    let possible_combinations = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for( var i=0; i < 11; i++ )
      text += possible_combinations.charAt(Math.floor(Math.random() * possible_combinations.length));
    return text;
  }

  // Define default scorecard sample
  getEmptyScoreCard():ScoreCard{
    return {
      id: this.makeid(),
      name: "",
      data: {
        "orgunit_settings": {
          "parent": "USER_ORGUNIT",
          "level": "LEVEL-2"
        },
        "show_score": false,
        "show_rank": false,
        "rank_position_last": true,
        "header": {
          "title": "",
          "sub_title":"",
          "description": "",
          "show_arrows_definition": true,
          "show_legend_definition": false,
          "template": {
            "display": false,
            "content": ""
          }
        },
        "legendset_definitions": [
          {
            "color": "#008000",
            "definition": "Target achieved / on track"
          },
          {
            "color": "#FFFF00",
            "definition": "Progress, but more effort required"
          },
          {
            "color": "#FF0000",
            "definition": "Not on track"
          },
          {
            "color": "#D3D3D3",
            "definition": "N/A"
          },
          {
            "color": "#FFFFFF",
            "definition": "No data"
          }
        ],
        "highlighted_indicators": {
          "display": false,
          "definitions": []
        },
        "data_settings": {
          "indicator_holders": [],
          "indicator_holder_groups": []
        },
        "additional_labels": [],
        "footer": {
          "display_generated_date": false,
          "display_title": false,
          "sub_title": null,
          "description": null,
          "template": null
        },
        "indicator_dataElement_reporting_rate_selection": "Indicators"
      }
    }
  }

  // define a default indicator structure
  getIndicatorStructure(name:string, id:string): any{
    return {
          "name": name,
          "id": id,
          "title": name,
          "high_is_good": true,
          "value": 0,
          "weight": 100,
          "legend_display": true,
          "legendset": [
            {
              "color": "#008000",
              "min": "80",
              "max": "-"
            },
            {
              "color": "#FFFF00",
              "min": "60",
              "max": "80"
            },
            {
              "color": "#FF0000",
              "min": "0",
              "max": "60"
            }
          ],
          "additional_label_values": {},
          "bottleneck_indicators": [],
          "arrow_settings": {
            "effective_gap": 5,
            "display": true
          },
          "label_settings": {
            "display": true,
            "font_size": ""
          }
        }

  }

  // A function used to decouple indicator list and prepare them for a display
  getItemsFromGroups(): any[]{
    let indicators_list = [];
    for(let data of this.scorecard.data.data_settings.indicator_holder_groups ){
      for( let holders_list of data.indicator_holder_ids ){
        for( let holder of this.scorecard.data.data_settings.indicator_holders ){
          if(holder.holder_id == holders_list){
            indicators_list.push(holder)
          }
        }
      }
    }
    return indicators_list;
  }

  // simplify title displaying by switching between two or on indicator
  getIndicatorTitle(holder): string{
    var title = [];
    for( let data of holder.indicators ){
      title.push(data.title)
    }
    return title.join(' / ')
  }

  // assign a background color to area depending on the legend set details
  assignBgColor(object,value): string{
    var color = "#BBBBBB";
    for( let data of object.legendset ){
      if(data.max == "-"){

        if(parseInt(value) >= parseInt(data.min) ){
          color = data.color;
        }
      }else{
        if(parseInt(value) >= parseInt(data.min) && parseInt(value) <= parseInt(data.max)){
          color = data.color;
        }
      }
    }
    return color;
  }

  //check if the indicator is already added in a scorecard
  indicatorExist(holders,indicator): boolean {
  let check = false;
  for( let holder of holders ){
    for( let indicatorValue of holder.indicators ){
      if(indicatorValue.id == indicator.id){
        check = true;
      }
    }
  }
  return check;
};

  // check if this is the current selected group
  is_current_group(group: any):boolean {
    let check = false;
    if(group.id == this.current_holder_group.id) {
      check = true;
    }
    return check;
  }

  // check if this is the current selected indicator
  is_current_indicator(indicator: any):boolean {
    let check = false;
    if ( indicator.holder_id == this.current_indicator_holder.holder_id ){
      check = true;
    }
    return check;
  }

  showTextEditor(){
    this.show_editor = !this.show_editor;
  }

  addAditionalLabel(){
    if(this.newLabel != ""){
      this.scorecard.data.additional_labels.push(this.newLabel);
      for ( let holder of this.scorecard.data.data_settings.indicator_holders ){
        for (let indicator of holder.indicators ){
          indicator.additional_label_values[this.newLabel] = "";
        }
      }
      console.log(this.scorecard.data.data_settings);
      this.newLabel = "";
    }
  }
  deleteAdditionalLabel(label){
    this.scorecard.data.additional_labels.splice(this.scorecard.data.additional_labels.indexOf(label),1);
    for ( let holder of this.scorecard.data.data_settings.indicator_holders ){
      for (let indicator of holder.indicators ){
        indicator.additional_label_values[this.newLabel] = "";
      }
    }
    console.log(this.scorecard.data.data_settings);
  }

  getIndicatorLabel(indicator, label){
    let labels = [];
    for( let data of indicator.indicators ){
      if(data.additional_label_values[label] != null && data.additional_label_values[label] != ""){
        labels.push(data.additional_label_values[label])
      }
    }
    return labels.join(' / ')
  }
  // saving scorecard details
  saveScoreCard(action: string = "save"): void {
    // display error if some fields are missing
    if(this.scorecard.data.data_settings.indicator_holders.length == 0 || this.scorecard.data.header.title == '' || this.scorecard.data.header.description == ''){
      this.someErrorOccured = true;
      if(this.scorecard.data.header.description == ''){
        this.discription_element.nativeElement.focus();
      }
      if(this.scorecard.data.header.title == ''){
        this.title_element.nativeElement.focus();
      }
      setTimeout(() => {
        this.someErrorOccured = false;
      }, 3000);

    }else{
      // delete all empty indicators if any
      this.cleanUpEmptyColumns();

      // post the data
      this.saving_scorecard = true;
      if(action == "save"){
        this.scorecardService.create(this.scorecard).subscribe(
          (data) => {
            this.saving_scorecard = false;
            this.router.navigate(['view',this.scorecard.id]);
          },
          error => {
            this.saving_error = true;
            this.saving_scorecard = false
          }
        );
      }
      else{
        this.scorecardService.update(this.scorecard).subscribe(
          (data) => {
            this.saving_scorecard = false;
            this.router.navigate(['view',this.scorecard.id]);
          },
          error => {
            this.saving_error = true;
            this.saving_scorecard = false
          }
        );
      }
    }


  }

  /**
   * Bottleneck indicator issues
   * @param indicator
   */
  showBotleneckEditor(indicator){
    if(this.show_bottleneck_indicators){
      for( let holder of this.scorecard.data.data_settings.indicator_holders ){
        for (let item of holder.indicators ){
          if(item.id == indicator.id){
            item.bottleneck_indicators = this.bottleneck_card.indicator.bottleneck_indicators;
          }
        }
      }
    }else{
      this.bottleneck_card.indicator = indicator;
      this.bottleneck_card.indicator_ready = true;
    }

    this.show_bottleneck_indicators = !this.show_bottleneck_indicators;
  }

  // deal with all issues during group type switching between dataelent, indicators and datasets
  switchBottleneckType(current_type): void{
    this.bottleneck_card.listReady = false;
    this.bottleneck_card.groupQuery = null;
    if(current_type == "indicators"){
      this.bottleneck_card.current_groups = this.indicatorGroups;
      if(this.bottleneck_card.current_groups.length != 0){
        this.load_bottleneck_card_list(this.bottleneck_card.current_groups[0].id, current_type)
      }
    }else if(current_type == "dataElements"){
      this.bottleneck_card.current_groups = this.dataElementGroups;
      if(this.bottleneck_card.current_groups.length != 0){
        this.load_bottleneck_card_list(this.bottleneck_card.current_groups[0].id, current_type)
      }
    }else if(current_type == "datasets"){
      this.bottleneck_card.current_groups = this.dataset_types;
      if(this.bottleneck_card.current_groups.length != 0){
        this.load_bottleneck_card_list(this.bottleneck_card.current_groups[0].id, current_type)
      }
    }else if(current_type == "programs"){
      this.bottleneck_card.current_groups = this.programs;
      if(this.bottleneck_card.current_groups.length != 0){
        this.load_bottleneck_card_list(this.bottleneck_card.current_groups[0].id, current_type)
      }
    }else if(current_type == "event"){
      this.bottleneck_card.current_groups = this.programs;
      if(this.bottleneck_card.current_groups.length != 0){
        this.load_bottleneck_card_list(this.bottleneck_card.current_groups[0].id, current_type)
      }
    }else{

    }

  }

  // load items to be displayed in a list of indicators/ data Elements / Data Sets
  load_bottleneck_card_list(group_id,current_type): void{
    this.bottleneck_card.listQuery = null;
    this.bottleneck_card.activeGroup = group_id;
    this.bottleneck_card.listReady = true;
    this.bottleneck_card.current_listing = [];
    this.bottleneck_card.done_loading_list = false;
    this.bottleneck_card.error_loading_list = {};
    if( current_type == "indicators" ){
      let load_new = false;
      for ( let group  of this.indicatorGroups ){
        if ( group.id == group_id ){
          if (group.indicators.length != 0){
            this.bottleneck_card.current_listing = group.indicators;
            this.bottleneck_card.done_loading_list = true;
          }else{
            load_new = true;
          }
        }
      }
      if ( load_new ){
        this.indicatorService.load(group_id).subscribe(
          indicators => {
            this.bottleneck_card.current_listing = indicators.indicators;
            this.bottleneck_card.done_loading_list = true;
            for ( let group  of this.indicatorGroups ){
              if ( group.id == group_id ){
                group.indicators = indicators.indicators;
              }
            }
          },
          error => {
            this.bottleneck_card.error_loading_list.occurred = true;
            this.bottleneck_card.error_loading_list.message = "Something went wrong when trying to load Indicators";
          }
        )
      }

    }
    else if( current_type == "dataElements" ){
      let load_new = false;
      for ( let group  of this.dataElementGroups ){
        if ( group.id == group_id ){
          if (group.dataElements.length != 0){
            this.bottleneck_card.current_listing = group.dataElements;
            this.bottleneck_card.done_loading_list = true;
          }else{
            load_new = true;
          }
        }
      }
      if ( load_new ) {
        this.dataElementService.load(group_id).subscribe(
          dataElements => {
            this.bottleneck_card.current_listing = dataElements.dataElements;
            this.bottleneck_card.done_loading_list = true;
            for ( let group  of this.dataElementGroups ){
              if ( group.id == group_id ){
                group.dataElements = dataElements.dataElements;
              }
            }
          },
          error => {
            this.bottleneck_card.error_loading_list.occurred = true;
            this.bottleneck_card.error_loading_list.message = "Something went wrong when trying to load Indicators";
          }
        )
      }
    }
    else if( current_type == "datasets" ){
      this.bottleneck_card.current_listing = [];
      let group_name = "";
      for (let dataset_group of this.dataset_types ){
        if(dataset_group.id == group_id){
          group_name = dataset_group.name;
        }
      }
      for( let dataset of this.datasets ){
        this.bottleneck_card.current_listing.push(
          {id:dataset.id+group_id, name: group_name+" "+dataset.name}
        )
      }
      this.bottleneck_card.done_loading_list = true;
    }
    else if( current_type == "programs" ){
      let load_new = false;
      for ( let group  of this.programs ){
        if ( group.id == group_id ){
          if (group.indicators.length != 0){
            this.bottleneck_card.current_listing = group.indicators;
            this.bottleneck_card.done_loading_list = true;
          }else{
            load_new = true;
          }
        }
      }
      if ( load_new ){
        this.programService.load(group_id).subscribe(
          indicators => {
            this.bottleneck_card.current_listing = indicators.programs[0].programIndicators;
            this.bottleneck_card.done_loading_list = true;
            for ( let group  of this.programs ){
              if ( group.id == group_id ){
                group.indicators = indicators.programs.programIndicators;
              }
            }
          },
          error => {
            this.bottleneck_card.error_loading_list.occurred = true;
            this.bottleneck_card.error_loading_list.message = "Something went wrong when trying to load Indicators";
          }
        )
      }

    }
    else if( current_type == "event" ){
      let load_new = false;
      for ( let group  of this.events ){
        if ( group.id == group_id ){
          if (group.indicators.length != 0){
            this.bottleneck_card.current_listing = group.indicators;
            this.bottleneck_card.done_loading_list = true;
          }else{
            load_new = true;
          }
        }
      }
      if ( load_new ){
        this.eventService.load(group_id).subscribe(
          indicators => {
            //noinspection TypeScriptUnresolvedVariable
            for (let event_data of indicators.programDataElements ){
              if(event_data.valueType == "INTEGER_ZERO_OR_POSITIVE" || event_data.valueType == "BOOLEAN" ){
                this.bottleneck_card.current_listing.push(event_data)
              }
            }
            this.bottleneck_card.done_loading_list = true;
            for ( let group  of this.events ){
              if ( group.id == group_id ){
                group.indicators = this.bottleneck_card.current_listing;
              }
            }
          },
          error => {
            this.bottleneck_card.error_loading_list.occurred = true;
            this.bottleneck_card.error_loading_list.message = "Something went wrong when trying to load Indicators";
          }
        )
      }

    }
    else{

    }
  }

  botteneckIndicatorExist(item): boolean {
    let check  = false;
    if(this.bottleneck_card.indicator.hasOwnProperty("bottleneck_indicators") ){
      for( let indicator of this.bottleneck_card.indicator.bottleneck_indicators ){
        if( indicator.id == item.id){
          check = true;
        }
      }
    }
    return check;
  }

  load_bottleneck_card_item(item){
    if(this.botteneckIndicatorExist(item)){

    }else{
      this.bottleneck_card.indicator.bottleneck_indicators.push(item);
    }
  }

  removeBottleneckIndicator(item){
    this.bottleneck_card.indicator.bottleneck_indicators.forEach( (value, index) =>{
      if( value.id == item.id ){
        this.bottleneck_card.indicator.bottleneck_indicators.splice(index,1);
      }
    })
  }

  ngOnDestroy() {
    tinymce.remove(this.editor);
  }
}
