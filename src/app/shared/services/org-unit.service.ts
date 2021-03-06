import { Injectable } from '@angular/core';
import { Http, Response } from '@angular/http';
import 'rxjs/Rx';
import {Observable} from 'rxjs';
import {Constants} from "../costants";

@Injectable()
export class OrgUnitService {

  nodes: any[] = null;
  constructor(private http: Http, private constant: Constants) { }

  //sorting an array of object
  sortArrOfObjectsByParam (arrToSort: Array<any>, strObjParamToSortBy: string, sortAscending: boolean = true) {
    if( sortAscending == undefined ) sortAscending = true;  // default to true

    if( sortAscending ) {
      arrToSort.sort( function ( a, b ) {
        if( a[strObjParamToSortBy] > b[strObjParamToSortBy] ){
          return 1;
        }else{
          return -1;
        }
      });
    }
    else {
      arrToSort.sort(function (a, b) {
        if( a[strObjParamToSortBy] < b[strObjParamToSortBy] ){
          return 1;
        }else {
          return -1
        }
      });
    }
  }

  // sort organisation units up to a certain level
  sortOrgUnits ( level ) {
    let main = [];
    this.sortArrOfObjectsByParam( this.nodes, 'name' );
    for ( let data of this.nodes ){
      if( level > 1) {
        this.sortArrOfObjectsByParam( data.children, 'name' );
        if( level > 2 ){
          for ( let subdata of data.children ) {
            this.sortArrOfObjectsByParam( subdata.children, 'name' );
            if( level > 3 ){
              for ( let subdata1 of subdata.children ) {
                this.sortArrOfObjectsByParam( subdata1.children, 'name' );
              }
            }
          }
        }

      }
    }
  }

  // Generate Organisation unit url based on the level needed
  generateUrlBasedOnLevels (level: number){
    var fields: string;
    if ( level == 1 ) {
      fields = 'id,name';
    }else if ( level == 2 ) {
      fields = 'id,name,children[id,name]';
    }else if ( level == 3 ) {
      fields = 'id,name,children[id,name,children[id,name]]';
    }else if ( level == 4 ) {
      fields = 'id,name,children[id,name,children[id,name,children[id,name]]]';
    }else if ( level == 5 ) {
      fields = 'id,name,children[id,name,children[id,name,children[id,name,children[id,name]]]]';
    }

    return fields;
  }

  // Get system wide settings
  getOrgunitLevelsInformation () {
    return this.http.get(this.constant.root_dir + 'api/organisationUnitLevels.json?fields=id')
      .map((response: Response) => response.json())
      .catch( this.handleError );
  }

  // Get system wide settings
  getAllOrgunitsForTree (fields) {
    return this.http.get(this.constant.root_dir + 'api/organisationUnits.json?filter=level:eq:1&paging=false&fields=' + fields)
      .map((response: Response) => response.json())
      .catch( this.handleError );
  }

  populateOrgunit ()  {
    this.getOrgunitLevelsInformation()
      .subscribe(
        (data: any) => {
          let fields = this.generateUrlBasedOnLevels( data.pager.total );
          this.getAllOrgunitsForTree( fields )
            .subscribe(
              ( orgUnits: any ) => {
                this.nodes = orgUnits.organisationUnits;
              },
              error => {
                console.log('something went wrong while fetching Organisation units')
              }
            );
        },
        error => {
          console.log('something went wrong while fetching Organisation units ')
        }
      );
  }

  // Handling error
  handleError (error: any) {
    return Observable.throw( error );
  }


}


