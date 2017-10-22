import { Component, ViewChild, ChangeDetectorRef, OnInit } from '@angular/core';
import { DirectionsRenderer } from '@ngui/map';
import { AngularFirestore } from 'angularfire2/firestore';
import { Observable } from 'rxjs/Observable';
import { ActivatedRoute } from '@angular/router';
import { AngularFireDatabase, AngularFireList } from 'angularfire2/database';
import { Org } from '../org/org.component';
import { AuthService } from '../auth.service';
import { DrawingManager } from '@ngui/map';
import { ElementRef } from '@angular/core';
import { Validators, FormGroup, FormArray, FormBuilder } from '@angular/forms';

@Component({
  selector: 'app-incident',
  templateUrl: './incident.component.html',
  styleUrls: ['./incident.component.css']
})
export class IncidentComponent implements OnInit {
  deleting: boolean;

  colors = {police: '#1E90FF',
            firedept: '#b30000',
            paramedics: '#999900',
            lifeguard: '#009900'};

  // Name and start point of the map
  title = 'My first AGM project';
  @ViewChild(DirectionsRenderer) directionsRendererDirective: DirectionsRenderer;
  autocomplete: any;
  address: any = {};
  center: any;
  d = false;
  directionsEnabled = false;
  directionsRenderer: google.maps.DirectionsRenderer;
  directionsResult: google.maps.DirectionsResult;
  direction: any = {
    origin: '',
    destination: '',
    travelMode: 'DRIVING'};

  mapOptions = {
    zoom: 14,
    mapTypeId: 'roadmap'
  };

  placeSearch;
  componentForm = {
    street_number: 'short_name',
    route: 'long_name',
    locality: 'long_name',
    administrative_area_level_1: 'short_name',
    country: 'long_name',
    postal_code: 'short_name'
  };

  mapInfo: any = {};
  currentPos: string;

  selectedShape: any;

  itemsRef: AngularFireList<any>;
  items: Observable<any[]>;
  id: any;
  incident: any;
  org: Observable<Org>;

  polygonsHandler: Observable<any>;
  circlesHandler: Observable<any>;
  squaresHandler: Observable<any>;
  selectedOverlay: any;
  @ViewChild(DrawingManager) drawingManager: DrawingManager;

  // DONT REALLY USE THESE NOT ASYNC SO NOT ALWAYS GOING TO GET THEM
  userInfo;
  orgInfo;

  markersHandler: Observable<any>;

  userPos: any = [];
  userID: any;
  userPicURL: any;

  myLocation: any;

  realTimePosition: any;

  markers;

  currentPinText = '';
  currentTeamPin = {name:''};

  dco = {
  position: 2,
  drawingModes: ['marker','circle', 'polygon']
  };
  constructor(private route: ActivatedRoute, public db: AngularFireDatabase, private afs: AngularFirestore, public auth: AuthService,
              private cdr: ChangeDetectorRef) { this.deleting = false; }

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id'); // Use for specific keys later

    this.auth.user.subscribe(user => {
      this.userInfo = user;
      this.userID = user.uid;
      this.userPicURL = user.photoURL;
      console.log(user);
      this.myLocation = this.db.object('incidents/' + this.id + '/locations/' + user.uid);

    });

    setInterval(() => {
      this.getCurrentPos(); }, 1000);

    // let rtl = this.db.list('incidents/' + this.id + '/locations');
    // this.realTimePosition = rtl.valueChanges().subscribe(res => console.log(res));

    this.incident = this.db.object('incidents/' + this.id );
    this.incident.valueChanges().subscribe(doc => {
      this.org = this.afs.doc('org/' + doc.orgId).valueChanges();
      this.org.subscribe( res => { this.orgInfo = res; });
    });

    const polygons = this.db.list('incidents/' + this.id + '/polygons');
    this.polygonsHandler = polygons.valueChanges();

    this.markers = this.db.list('incidents/' + this.id + '/markers');
    this.markersHandler = this.markers.valueChanges();

    const circles = this.db.list('incidents/' + this.id + '/circles');

    this.items = circles.snapshot.map(changes => {
      console.log(changes);
      return changes.map(c => ({ key: c.payload.key, ...c.payload.val() }));
    });

    this.circlesHandler = circles.valueChanges();

    const squares = this.db.list('incidents/' + this.id + '/squares');
    this.squaresHandler = squares.valueChanges();

    this.drawingManager['initialized$'].subscribe(dm => {
      google.maps.event.addListener(dm, 'overlaycomplete', event => {
        if (event.type === google.maps.drawing.OverlayType.POLYGON) {
          dm.setDrawingMode(null);
          this.selectedOverlay = event.overlay;
          this.selectedOverlay.setEditable(true);
          console.log(event.overlay.getPath().getArray());
          const points = [];
          event.overlay.getPath().getArray().forEach(point => {
            points.push({lat :  point.lat(), lng : point.lng()});
          });
          const newPoly = { points : points, color: this.colors[this.userInfo.OrgIds['nO2epGylHwK2A8CZK614']] };
          polygons.push(newPoly);
          this.selectedOverlay = event.overlay;
        }else if (event.type === google.maps.drawing.OverlayType.CIRCLE) {
          dm.setDrawingMode(null);
          this.selectedOverlay = event.overlay;
          this.selectedOverlay.setEditable(true);
          console.log(event);

          const newCircle = {
            center: {lat: event.overlay.center.lat(), lng: event.overlay.center.lng()},
            radius: event.overlay.getRadius(),
            color: this.colors[this.userInfo.OrgIds['nO2epGylHwK2A8CZK614']],
            clickable: true
          };
          circles.push(newCircle);
        }else if (event.type === google.maps.drawing.OverlayType.RECTANGLE) {
          dm.setDrawingMode(null);
          this.selectedOverlay = event.overlay;
          this.selectedOverlay.setEditable(true);
          console.log(event.overlay);
          const points = [];
          event.overlay.getPath().getArray().forEach(point => {
            points.push({lat :  point.lat(), lng : point.lng()});
          });
          const newPoly = { points : points, color: this.colors[this.userInfo.OrgIds['nO2epGylHwK2A8CZK614']] };
          polygons.push(newPoly);
        } else if (event.type === google.maps.drawing.OverlayType.MARKER) {
          dm.setDrawingMode(null);
          console.log(event);

          if(this.currentTeamPin.name == ''){
            this.currentTeamPin.name = 'paramedics'
          }
          if(this.currentPinText == ''){
            this.currentPinText = 'A person is seriously harmed';
          }
          let newPin = {description: this.currentPinText, team: this.currentTeamPin, pos:[event.overlay.position.lat(), event.overlay.position.lng()]};

          this.markers.push(newPin);
        }

        event.overlay.setMap(null);
        delete event.overlay;
      });
    });

      this.directionsRendererDirective['initialized$'].subscribe( directionsRenderer => {
        this.directionsRenderer = directionsRenderer;
      });
  }

  del() {
    this.deleting = !this.deleting;
    console.log(this.deleting);
  }

  directionsChanged() {
    this.directionsResult = this.directionsRenderer.getDirections();
    this.cdr.detectChanges();
  }

  showDirection() {
    this.direction.origin = this.userPos[0].toString() + ", " + this.userPos[1].toString();
    this.directionsRendererDirective['showDirections'](this.direction);
  }

  quickAddPin(team, quick) {
    this.currentPinText = quick;
    this.currentTeamPin = team;
  }

  initialized(autocomplete: any) {
    this.autocomplete = autocomplete;
  }
  placeChanged(place) {
    this.center = place.geometry.location;
    for (let i = 0; i < place.address_components.length; i++) {
      let addressType = place.address_components[i].types[0];
      this.address[addressType] = place.address_components[i].long_name;
    }
    this.cdr.detectChanges();
  }

  getCurrentPos() {
    // Try HTML5 geolocation.
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(position => {
        const pos = [
          position.coords.latitude,
          position.coords.longitude
        ];
        this.userPos = [
          position.coords.latitude,
          position.coords.longitude
        ];
        // this.myLocation.update({pos:pos,image:this.userPicURL});

        return pos;
      }, function() {
        console.log('dad is mad at mom');
      });
    } else {
      // Browser doesn't support Geolocation
      console.log('dad doesnt have internet');
    }
  }

  clicked({target: marker}) {

    marker.nguiMapComponent.openInfoWindow('iw', marker);
  }

  clearDirection () {
    this.directionsRenderer.setMap(null);
  }




  clickPolygon($event) {
    if (this.deleting){

    }
  }

  clickCircle($event) {
    console.log('clicked');
    console.log($event);
    if (this.deleting) {
      this.findCircle($event);

      // const circles = this.db.list('incidents/' + this.id + '/circles');
      // this.circlesHandler = circles.snapshotChanges();
      // circles.remove($event);
    }
  }

  findCircle(event) {
    console.log('what');
    console.log(event.center);

    this.circlesHandler.subscribe(res => {
      console.log(res);
      for (let i = 0; i < res.length; i++) {
        console.log(res[i].center);
        if (Math.abs(event.center.lng - res[i].center.lng) < .000001 && Math.abs(event.center.lat - res[i].center.lat) < .000001) {
          const circles = this.db.list('incidents/' + this.id + '/circles');

          // circles.remove(res[i]);
          return;
        }
      }
    });
  }


}

// pin Interface
interface Marker {
  lat: any;
  lng: any;
  label?: string;
  draggable: boolean;
}
