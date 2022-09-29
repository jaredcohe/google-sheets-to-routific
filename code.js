// https://routific-platform.readme.io/reference#api-response

// onClick button on Create Route, open the form
function onClickOpenRoutificForm() {
  showRouteSidebar();
};

function showRouteSidebar(e) {
  var html = HtmlService.createHtmlOutputFromFile('routificForm')
      .setTitle('Create Route')
      .setWidth(300);

  SpreadsheetApp.getUi()
      .showSidebar(html);
};

function receiveRouteFromForm(formData) {
    Logger.log(formData);
    var ui = SpreadsheetApp.getUi();
    var routeName = formData["routeName"];
    var lastRoute = formData["lastRoute"];
    var routeId = formData["routeId"];
    if ((routeId == '') || (routeId == null) || (routeName == '') || (routeName == null)) {
        ui.alert("Missing Route ID or Route Name");
    } else {
        routeRunner(routeName, routeId, lastRoute);
    };
};

function routeRunner(routeName, routeId, lastRoute) {
    var ui = SpreadsheetApp.getUi();
    var stopsArray = getStopsDataFromSheet(routeName, routeId, lastRoute);
    var stopsObjects = convertStopsArrayToStopsObject(stopsArray);
    var driversArray = getDriversList();
    var driversObjects = convertDriversArrayToDriversObject(driversArray);
    var response = sendRoutesToRoutific(stopsObjects, driversObjects, routeName);
    var responseContentText = response.getContentText();
    var responseContentHash = JSON.parse(responseContentText);

    if (response.getResponseCode() == 200) {
        ui.alert("Route created https://app.routific.com/#/hud/projects <a href='https://app.routific.com/#/hud/projects'>in routific</a>" + responseContentHash["id"]);
    } else {
        ui.alert("Error code is: " + responseContentHash["error_code"] +
        ".\r\n\r\nError message is: " + responseContentHash["message"] + 
        ".\r\n\r\nDo you have all the data in on the Delivery Plan and Drivers sheets? " +
        "You need Delivery Day, Delivery Start Time, Delivery End Time, Driver Assignment, " +
        "Address, Order #, and Formatted Phone.");
    };
};

function getStopsDataFromSheet(routeName, routeId, lastRoute) {
    var activeSheet = SpreadsheetApp.getActiveSheet();
    var lastRowOfData = activeSheet.getLastRow();
    var lastColumnOfData = activeSheet.getLastColumn();
    
    var numberOfRows = lastRowOfData-6
    var rangeOfAllData = activeSheet.getRange(7, 1, numberOfRows, lastColumnOfData).getValues();
    var arrayOfOrdersToRoute = [];
    var eachRow;
    var routeIdPerRow;

    for (var i=0; i<numberOfRows; i++) {
        eachRow = rangeOfAllData[i];
      
        // Check that the Assignment isn't null and matches the RouteId
        if ((!((eachRow[7] == '') || (eachRow[7] == null))) && (eachRow[7] == routeId)) {
            arrayOfOrdersToRoute.push(eachRow);
        };
    };
    return arrayOfOrdersToRoute;
}

function convertStopsArrayToStopsObject(arrayOfOrdersToRoute) {
    var numberOfStops = arrayOfOrdersToRoute.length;
    var stopsObjects = [];

    for (var i=0; i<numberOfStops; i++) {
        var name = arrayOfOrdersToRoute[i][0];
        var address = arrayOfOrdersToRoute[i][13];
        var start = arrayOfOrdersToRoute[i][4];
        var notes = arrayOfOrdersToRoute[i][9];
        var startHours = start.getHours();
        var startHours = ("0" + startHours).slice(-2);
        var startMinutes = start.getMinutes();
        var startMinutes = ("0" + startMinutes).slice(-2);
        start = [startHours, startMinutes].join(':');
        var end = arrayOfOrdersToRoute[i][5];
        var endHours = end.getHours();
        var endHours = ("0" + endHours).slice(-2);
        var endMinutes = end.getMinutes();
        var endMinutes = ("0" + endMinutes).slice(-2);
        end = [endHours, endMinutes].join(':');
        
        var phone_number = arrayOfOrdersToRoute[i][17];

        var newStopsObject = {
            "name": name,
            "location": {
                "address": address
            },
            "start": start,
            "end": end,
            "phone_number": phone_number,
            "custom_notes": { "Notes": notes }
        }
        stopsObjects.push(newStopsObject);
    };
    return stopsObjects;
};

function getDriversList() {
    var activeSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Drivers");
    var lastRowOfData = activeSheet.getLastRow();
    var lastColumnOfData = activeSheet.getLastColumn();
    var numberOfRows = lastRowOfData-1
    var rangeOfAllData = activeSheet.getRange(2, 1, numberOfRows, lastColumnOfData).getValues();
    var driversArray = [];
    var eachRow;
    var routeIdPerRow;

    for (var i=0; i<numberOfRows; i++) {
        var eachRow = rangeOfAllData[i];
        driversArray.push(eachRow);
    };
    return driversArray;
};

function convertDriversArrayToDriversObject(driversArray) {
    var numberOfDrivers = driversArray.length;
    var driversObjects = [];

    for (var i=0; i<numberOfDrivers; i++) {
        var status = driversArray[i][9];
        if (status === "Active") {
            var name = driversArray[i][0];
            var full_name = driversArray[i][1];
            var start_location = driversArray[i][2];
            var end_location = driversArray[i][3];
            var home_address = driversArray[i][4];
            var email = driversArray[i][5];
            var shift_start = driversArray[i][6];
            var shift_end = driversArray[i][7];
            var phone_number = driversArray[i][8];
            
    
            var newDriversObject = {
                "name": name,
                "start_location": {
                    "address": start_location,
                },
                "end_location": {
                    "address": end_location,
                },
                "shift_start": shift_start,
                "shift_end": shift_end,
                "phone_number": phone_number
            };
            
            driversObjects.push(newDriversObject);
       };
    };

    return driversObjects;
};

function sendRoutesToRoutific(stopsObjects, driversObjects, routeName) {

    var date = Utilities.formatDate(new Date(), "GMT-4", "yyyy-MM-dd");

    // Make a POST request with a JSON payload.
    var data = {
        "name": routeName,
        "date": date,
        "drivers": driversObjects,
        "stops": stopsObjects,
        "settings": {
            "shortest_time": true,
            "auto_balance": false,
            "default_duration": 5,
            "fixed_departure_time": true,
            "traffic": 1.2 // Traffic is between 1-2, with 1 being least
        }
    };
    
    var options = {
      'method' : 'post',
      'contentType': 'application/json',
      'muteHttpExceptions': true,
      'payload' : JSON.stringify(data),
      'headers' : { "Authorization" : "Bearer INSERT_TOKEN" }
    };
    
    var response = UrlFetchApp.fetch('https://product-api.routific.com/v1.0/project', options);
    return response;
};

// Routific reporting
// https://api.routific.com/product/projects
function getListOfAllRoutificProjects() {
    Logger.log("routific.gs > getListOfAllRoutificProjects");

    // Make a GET request with a JSON payload.
    var options = {
      'method' : 'get',
      'contentType': 'application/json',
      'muteHttpExceptions': true,
      'headers' : { "Authorization" : "Bearer INSERT_TOKEN" }
    };
    
    var response = UrlFetchApp.fetch('https://api.routific.com/product/projects', options);
    return response;
};

function getListOfRoutificProjectsIdsForDate(date) {
    var allRoutificProjectsResponse = getListOfAllRoutificProjects();
    var responseContentText = allRoutificProjectsResponse.getContentText();
    var responseContentHash = JSON.parse(allRoutificProjectsResponse);
    var routificDate = responseContentHash[0]["date"]
    
    var dateFormatted = Utilities.formatDate(date, "GMT-4", "yyyy-MM-dd");
    var dateString = dateFormatted.toString();
    
    var listOfTodayProjectIds = [];
    var dateToCheck;
    var countOfAllProjects = responseContentHash.length;
    
    for (var i=0; i<countOfAllProjects; i++) {
        dateToCheck = responseContentHash[i]["date"];
        if (dateToCheck == dateString) {
            listOfTodayProjectIds.push(responseContentHash[i]["_id"]);
        };  
    };
  
    var ui = SpreadsheetApp.getUi();

    return listOfTodayProjectIds;
};


function getRoutificProjectById(id) {

    // Make a GET request with a JSON payload.
    var options = {
      'method' : 'get',
      'contentType': 'application/json',
      'muteHttpExceptions': true,
      'headers' : { "Authorization" : "Bearer INSERT_TOKEN" }
    };
    
    var url = "https://api.routific.com/product/projects/" + id
    var response = UrlFetchApp.fetch(url, options);
    return response;
};

// https://routific-platform.readme.io/reference#retrieve-project
function getProjectsForDate() {
    var ui = SpreadsheetApp.getUi();

    // Confirmation check
    var response = ui.alert("Get Miles", "Make sure all test routes are deleted!!!!", ui.ButtonSet.YES_NO);
    if (response == ui.Button.YES) {
        var routificReportingSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Routific Reporting");
        var dateToGetProjectsFor = routificReportingSheet.getRange(1, 5).getValue();
    
        var listOfRoutificProjectsIdsForDate = getListOfRoutificProjectsIdsForDate(dateToGetProjectsFor);
        var countOfProjects = listOfRoutificProjectsIdsForDate.length;
        var projectsArray = [];
        var rawResponseFromRoutific;
        var jsonResponseFromRoutific;
        
        for (var i=0; i<countOfProjects; i++) {
            rawResponseFromRoutific = getRoutificProjectById(listOfRoutificProjectsIdsForDate[i]);
            jsonResponseFromRoutific = JSON.parse(rawResponseFromRoutific);
            projectsArray.push(jsonResponseFromRoutific);
        };
        
        var fleetArray = [];
        var distancesArray = [];
        
        projectsArray.forEach(function (project) {
        
            for (var driver in project["solution"]["distances"]) {
                distancesArray.push([driver, project["solution"]["distances"][driver]]);
            }
            
            for (var driver in project["fleet"]) {
                fleetArray.push([project["fleet"][driver]["_id"], project["fleet"][driver]["name"]]);
            }
        });
        
        routificReportingSheet.getRange(7, 1, 100, 5).clearContent()
        routificReportingSheet.getRange(7, 1, fleetArray.length, fleetArray[0].length).setValues(fleetArray);
        routificReportingSheet.getRange(7, 4, distancesArray.length, distancesArray[0].length).setValues(distancesArray);
    };
};
