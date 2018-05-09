import { Observable } from 'rxjs/Rx';
import { ProductsDataService } from './../../services/products-data.service';
import { AngularFireDatabase } from 'angularfire2/database';
import { SessionService } from './../../services/session.service';
import { Config } from './../../config';
import { ToastrService } from 'ngx-toastr';
import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { ProductsService, CallOperator, Pagination } from './../../services/products.service';
import { PageType } from './../headers/common-header/common-header.component';
import { Product } from './../Product';
import { BlockUI, NgBlockUI } from 'ng-block-ui';
import { Price } from '../Price';
import * as firebase from 'firebase'
import { error } from 'protractor';
import { MatPaginator } from '@angular/material';

@Component({
  selector: 'app-clothes-collection',
  templateUrl: './clothes-collection.component.html',
  styleUrls: ['./clothes-collection.component.scss']
})
export class ClothesCollectionComponent implements OnInit {
  @BlockUI('block-products') blockUIProducts: NgBlockUI;

  private pageType: PageType;
  collectionHeader;

  brandControl = new FormControl();
  brandsList = [];

  materialControl = new FormControl();
  materialsList = ['Leather', 'Coton', 'Wool', 'Cashmere', 'Silk', 'Polyster', 'Nylon', 'Windproof', 'Water resistant'];

  sizeControl = new FormControl();
  sizeGroups = [
    {
      name: 'Small',
      size: ['XS', 'S']
    }, {
      name: 'Medium',
      size: ['M']
    }, {
      name: 'Large',
      size: ['L', 'XL', 'XXL', 'XXL']
    }

  ];

  colorControl = new FormControl();
  colorsList = [];

  priceCurrency = "kr";
  minPrice = 0;
  maxPrice = 5000;
  priceRange = [200, 4500];
  priceRangeHtml = "200 - 4500";
  perPage;
  sortingOption = "";

  topsCollection = ['Shirts', 'T-Shirts', 'Knitwear', 'Polo Shirts']
  jeansCollection = ['Skinny', 'Regular']
  outerwareCollection = ['Jackets', 'Coats', 'Blazers', 'Rainwear', 'Vests']
  suitsCollection = ['Suits', 'Tuxedos', 'Blazers', 'Trousers', 'Waistcoats', 'Accessories']
  trousersCollection = ['Chinos', 'Casual', 'Formal', 'Sweat Pants']

  products: Product[] = [];
  orgProducts: Product[] = [];
  errorMessage = {
    text: "",
    class: ""
  };

  returnPageUrl: string;
  returnSubPageUrl: string;

  filteredBrands = [];
  filteredColors = [];

  @ViewChild(MatPaginator) paginator: MatPaginator;
  length = 10; // total products
  pageSize = 5; // limit
  offset = 0;
  pageSizeOptions = [5, 10, 25, 100];
  currentContentType;

  constructor(private route: ActivatedRoute, private productService: ProductsService, private toastr: ToastrService, private router: Router, private db: AngularFireDatabase, private productsDataService: ProductsDataService) {
    this.route.paramMap.subscribe(params => {
      let type = params.get('type');
      this.pageType = (type) ? PageType[type.charAt(0).toUpperCase() + type.substr(1).toLowerCase()] : null;
      switch (this.pageType) {
        case PageType.Men:
          this.returnPageUrl = "clothes-collection";
          this.returnSubPageUrl = "men"
          this.collectionHeader = "url('../../assets/img/collection/men/banner_1.jpg')";
          break;
        default:
          //navigate to unknown page
          this.router.navigate(['unknown']);
          break;
      }
    })
  }

  ngOnInit() {
    // this.getBrandsCallByAPI();
    // this.getColorsCallByAPI();
    /* 
    * Below code is for development perposes ()
    */
    this.brandsList = this.staticBrandsList;
    this.colorsList = ["brown", "blue", "black", "white", "gray", "beige"];
  }

  getType() {
    return PageType[this.pageType].toString();
  }

  getProductsCall(callType: CallOperator) {
    this.startBlocking();
    let pagination: Pagination = { limit: this.pageSize, offset: this.offset }
    let productsService = this.productService.callGet(callType, "", "", pagination);
    if (productsService instanceof Promise) {
      productsService.then(
        promise => promise.subscribe(
          products => {
            if (products instanceof Observable) {
              products.subscribe(products => {
                this.loadPaginationProducts(products);
              }, error => {
                this.loadProductsError();
              })
              return;
            }
            this.loadPaginationProducts(products);
          },
          error => { // catch observer error (in getting products)
            this.loadProductsError();
          }))
        .catch(
          error => { // // catch promise error (in getting api token)
            this.loadProductsError();
          }
        )
    }
    else {
      productsService.subscribe(
        (products) => {
          if (products instanceof Observable) {
            products.subscribe(products => {
              this.loadPaginationProducts(products);
            }, error => {
              this.loadProductsError();
            })
            return;
          }
          this.loadPaginationProducts(products);
        },
        error => { // catch observer error (in getting products)
          this.loadProductsError();
        })
    }
  }

  private loadPaginationProducts(products: any) {
    this.length = products.meta.results.all;
    this.loadProducts(products.data);
  }

  private startBlocking() {
    this.blockUIProducts.start();
    this.errorMessage.text = "";
  }

  loadProductsError() {
    if (this.blockUIProducts.isActive) this.blockUIProducts.stop();
    //this.products = [];
    this.errorMessage.text = "Unexpected error while loading. Admin is notified.";
  }

  loadProducts(products) {
    if (this.blockUIProducts.isActive) this.blockUIProducts.stop();
    if (!products || products.length === 0) {
      this.toast('No products found! Try different search options', 'Warning', 'warning', 5000);
      //this.products = [];
      this.errorMessage.text = "No products found! Try different search options";
      return;
    }
    let tProducts: Product[] = [];
    this.orgProducts = [];
    for (let product of products) {
      let tProduct: Product = new Product();
      tProduct.id = product.id;
      tProduct.sku = product.sku;
      tProduct.slug = product.slug;
      tProduct.name = product.name;
      tProduct.collections = product.relationships.collections.data;
      tProduct.categories = product.relationships.categories.data;
      tProduct.brands = product.relationships.brands.data;
      tProduct.brand = product.brand;
      let price: Price = new Price(product.meta.display_price.with_tax.amount, product.meta.display_price.with_tax.formatted, product.meta.display_price.with_tax.currency);
      tProduct.price = price;
      tProduct.images.push(Config.baseImagesUrl + product.relationships.main_image.data.id + ".jpg");
      for (let img of product.relationships.files.data) {
        tProduct.images.push(Config.baseImagesUrl + img.id + ".jpg");
      }
      //this.getFirebaseImgUrl(product.relationships.main_image.data.id).then(url => tProduct.mainImagePng = url).catch(error => console.log(`${tProduct.id}: ${product.relationships.main_image.data.id}: ${error.message}`));
      tProduct.discount = product.discount;
      tProduct.rating = product.rating;
      tProduct.color = product.color;
      tProduct.colorCode = product.colorCode;
      tProduct.fit = product.fit;
      tProduct.newArrival = product.newArrival;
      tProduct.reviews = product.reviews;
      tProduct.description = product.description;
      tProducts.push(tProduct);
      this.orgProducts.push(tProduct);
    }
    this.products = tProducts;
    this.errorMessage.text = "";
    this.notifyChange();
  }

  private toast(message, header, type, timeOut) {
    switch (type) {
      case "error":
        this.toastr.error(message, header, {
          timeOut: timeOut,
          easing: 'easeOutBounce',
          progressBar: true
        });
        break;
      case "warning":
        this.toastr.warning(message, header, {
          timeOut: timeOut,
          easing: 'easeOutBounce',
          progressBar: true
        });
        break;
      case "info":
        this.toastr.info(message, header, {
          timeOut: timeOut,
          easing: 'easeOutBounce',
          progressBar: true
        });
        break;
      case "success":
        this.toastr.success(message, header, {
          timeOut: timeOut,
          easing: 'easeOutBounce',
          progressBar: true
        });
        break;
    }
  }

  getFirebaseImgUrl(imgId) {
    //get image from firebase
    let storageRef = firebase.storage().ref();
    let starsRef = storageRef.child('product_images/' + imgId + '.png');
    return starsRef.getDownloadURL();
  }

  getProducts(type) {
    // Later I will change this code to load the content based on pageType
    // To simplify things for now, lets assume we have only Men's page 
    if (type !== this.currentContentType) this.resetPaginator(type);
    switch (type) {
      case "all":
        this.getProductsCall(CallOperator.AllProducts);
        //this.loadProducts(this.staticProducts);
        break;
      case "tops":
        this.getProductsCall(CallOperator.TopsProducts);
        break;
      case "jeans":
        this.getProductsCall(CallOperator.JeansProducts);
        break;
      case "t-shirts":
        this.getProductsCall(CallOperator.TShirtProducts);
        break;
      case "skinny":
        this.getProductsCall(CallOperator.SkinnyProducts);
        break;
      case "shirts":
        this.getProductsCall(CallOperator.ShirtsProducts);
        break;
      case "regular":
        this.getProductsCall(CallOperator.RegularProducts);
        break;
      case "polo shirts":
        this.getProductsCall(CallOperator.PoloShirtsProducts);
        break;
      case "knitwear":
        this.getProductsCall(CallOperator.KnitwearProducts);
        break;
    }

    // For future work...
    /*switch (this.pageType) {
      case PageType.Men:
        break;
      case PageType.Woman:
        break;
      case PageType.Kids:
        break;
      case PageType.Deals:
        break;
      default:
        break;
    }*/
  }

  unsupported(type) {
    // for product types that are not in added in API yet.
    type = type ? type.charAt(0).toUpperCase() + type.slice(1) : type;
    this.toastr.error(`${type} is not supported at the moment, please try View All, Tops or Jeans`, `${type} Products Not supported`, {
      timeOut: 2000,
      easing: 'easeOutBounce',
      progressBar: true,
      positionClass: 'toast-top-full-width'
    });
  }

  getBrandsCallByAPI() {
    // this.brandsList = this.staticBrandsList;
    let brandsService = this.productService.callGet(CallOperator.AllBrands);
    if (brandsService instanceof Promise) {
      brandsService.then(
        promise => promise.subscribe(
          brands => {
            this.loadBrands(brands);
          },
          error => { // catch observer error (load hardcoded brands)
            this.brandsList = this.staticBrandsList;
          }))
        .catch(
          error => { // catch observer error (load hardcoded brands)
            this.brandsList = this.staticBrandsList;
          }
        )
    }
    else {
      brandsService.subscribe(
        (brands) => {
          this.loadBrands(brands);
        },
        error => { // catch observer error (load hardcoded brands)
          this.brandsList = this.staticBrandsList;
        })
    }
  }

  private loadBrands(brands: any) {
    let tbrands = [];
    for (let brand of brands.data) {
      tbrands.push({
        id: brand.id,
        name: brand.name
      });
    }
    this.brandsList = tbrands;
  }

  getColorsCallByAPI() {
    let flowsService = this.productService.callGet(CallOperator.AllProductFlowEntries);
    if (flowsService instanceof Promise) {
      flowsService.then(
        promise => promise.subscribe(
          flows => {
            this.loadcolors(flows);
          },
          error => {
            this.colorsList = ["brown", "blue", "black", "white", "gray", "beige"];
          }))
        .catch(
          error => {
            this.colorsList = ["brown", "blue", "black", "white", "gray", "beige"];
          }
        )
    }
    else {
      flowsService.subscribe(
        (flows) => {
          this.loadcolors(flows);
        },
        error => { // catch observer error (in getting products)
          this.colorsList = ["brown", "blue", "black", "white", "gray", "beige"];
        })
    }
  }

  private loadcolors(flows) {
    if (flows && flows.data) {
      let colorCodes = new Set();
      for (let flow of flows.data) {
        if (flow.colorCode) {
          colorCodes.add(flow.colorCode);
        }
      }
      this.colorsList = Array.from(colorCodes);
    }
    else {
      this.colorsList = ["brown", "blue", "black", "white", "gray", "beige"];
    }
  }

  brandsChanged(event) {
    this.filteredBrands = [];
    if (event && event.value.length > 0) {
      for (let brand of event.value) {
        this.filteredBrands.push(brand.id);
      }
    }
    this.notifyChange();
  }

  colorsChanged(event) {
    this.filteredColors = [];
    if (event && event.value.length > 0) {
      for (let color of event.value) {
        this.filteredColors.push(color);
      }
    }
    this.notifyChange();
  }

  priceChange(value: any) {
    if (value) {
      this.priceRangeHtml = `${value[0]} - ${value[1]}`;
      this.notifyChange();
    }

  }

  private notifyChange() {
    this.productsDataService.productsData.next({
      products: this.products.slice(0),
      filteredBrands: this.filteredBrands,
      filteredColors: this.filteredColors,
      price: this.priceRange
    });
  }

  resetPaginator(type) {
    // reseting paginator
    this.pageSize = 5;
    this.offset = 0;
    if (this.paginator) this.paginator.pageIndex = 0;
    this.currentContentType = type;

    // resetting filters...
    this.filteredBrands = [];
    this.filteredColors = [];
    this.brandControl.reset();
    this.sizeControl.reset();
    this.colorControl.reset();
    this.materialControl.reset();
    this.priceRange = [200, 4500];
  }

  onPageChanged(event) {
    this.pageSize = event.pageSize;
    this.offset = (this.pageSize * (event.pageIndex + 1)) - this.pageSize;
    this.getProducts(this.currentContentType)
  }

  getPageIndex() {
    return this.paginator ? this.paginator.pageIndex + 1 : 1
  }

  previousPage() {
    if (!this.paginator) return;
    if (this.paginator.hasPreviousPage()) {
      this.paginator.pageIndex = this.paginator.pageIndex -1;
      this.offset = (this.pageSize * (this.paginator.pageIndex + 1)) - this.pageSize;
      this.getProducts(this.currentContentType)
    }
  }

  nextPage() {
    if (!this.paginator) return;
    if (this.paginator.hasNextPage()) {
      this.paginator.pageIndex = this.paginator.pageIndex +1;
      this.offset = (this.pageSize * (this.paginator.pageIndex + 1)) - this.pageSize;
      this.getProducts(this.currentContentType)
    }

  }

  get staticBrandsList() {
    return [{ "id": "45a50303-f9ba-4b0d-b50f-317c8691ac8a", "name": "Diesel" }, { "id": "3b138c3e-88de-4e58-8f03-ae174a6a7894", "name": "Hackett" }, { "id": "11820a98-d2a3-4368-bf7f-cce3e136ba69", "name": "Les Deux" }, { "id": "c7f240a5-46af-44ba-9a61-95270827bfb2", "name": "POLO RALPH LAUREN" }, { "id": "cf7c9204-9eb9-43ad-bd0c-30637f3a82df", "name": "LEE JEANS" }, { "id": "858828e3-b0e3-46a8-8aa4-8dff6c2cc076", "name": "Boss" }, { "id": "85d0308a-8b82-423c-b2b0-87800d9e9862", "name": "SAMSØE & SAMSØE" }, { "id": "1e0240ab-53fa-4f30-acef-b361754616d1", "name": "Gant" }];
  }

  //this property will be deleted after finishing developing this page
  //just to reduce amount of API calls (because it is limited for free users)
  get staticProducts() {
    return [
      {
        "type": "product",
        "id": "ea9e61ab-8c8a-4353-b182-aa480bc4b5d0",
        "name": "Gant Jeans",
        "slug": "GCL1315008",
        "sku": "GCL1315008",
        "manage_stock": true,
        "description": "Outer fabric: cotton 97%, polyester 2%, elastane 1%\nStraight leg\nFine wash at max. 40˚C",
        "price": [
          {
            "amount": 1450,
            "currency": "SEK",
            "includes_tax": true
          }
        ],
        "status": "live",
        "commodity_type": "physical",
        "meta": {
          "timestamps": {
            "created_at": "2018-04-30T17:25:08+00:00",
            "updated_at": "2018-04-30T17:28:51+00:00"
          },
          "display_price": {
            "with_tax": {
              "amount": 1450,
              "currency": "SEK",
              "formatted": "1,450 kr"
            },
            "without_tax": {
              "amount": 1450,
              "currency": "SEK",
              "formatted": "1,450 kr"
            }
          },
          "stock": {
            "level": 10,
            "availability": "in-stock"
          }
        },
        "relationships": {
          "files": {
            "data": [
              {
                "type": "file",
                "id": "033b05cc-abc9-4e61-b931-5d1b7f426f13"
              },
              {
                "type": "file",
                "id": "332018ec-99e0-4830-af2f-232e7d5bb259"
              }
            ]
          },
          "categories": {
            "data": [
              {
                "type": "category",
                "id": "d24fbadd-0067-487c-b45e-508947304906"
              },
              {
                "type": "category",
                "id": "af431233-cb8b-4a50-8e73-88e159974d60"
              },
              {
                "type": "category",
                "id": "df939eff-eb74-43d6-a209-c6a6eb87807c"
              }
            ]
          },
          "collections": {
            "data": [
              {
                "type": "collection",
                "id": "cdaadc9f-4657-475b-9b6a-e21a0c5322a9"
              }
            ]
          },
          "brands": {
            "data": [
              {
                "type": "brand",
                "id": "1e0240ab-53fa-4f30-acef-b361754616d1"
              }
            ]
          },
          "main_image": {
            "data": {
              "type": "main_image",
              "id": "0bb618e8-e392-49e3-9fe7-84c78a4d4dea"
            }
          }
        },
        "rating": 5,
        "discount": 0,
        "color": "Black",
        "fit": "Regular",
        "newArrival": false,
        "reviews": 5,
        "colorCode": "black",
        "mainImage": null,
        "brand": "Gant"
      },
      {
        "type": "product",
        "id": "f33479e8-a225-4c2d-8ef2-7b1f0f976e1d",
        "name": "Sullivan Slim Stretch Jean ",
        "slug": "RAF710613950001",
        "sku": "RAF710613950001",
        "manage_stock": true,
        "description": "98% cotton, 2% elastane\nVintage look\nButton fly\nMedium rise waist\nFine wash at max. 30˚C",
        "price": [
          {
            "amount": 1199,
            "currency": "SEK",
            "includes_tax": true
          }
        ],
        "status": "live",
        "commodity_type": "physical",
        "meta": {
          "timestamps": {
            "created_at": "2018-04-30T17:11:29+00:00",
            "updated_at": "2018-04-30T17:15:51+00:00"
          },
          "display_price": {
            "with_tax": {
              "amount": 1199,
              "currency": "SEK",
              "formatted": "1,199 kr"
            },
            "without_tax": {
              "amount": 1199,
              "currency": "SEK",
              "formatted": "1,199 kr"
            }
          },
          "stock": {
            "level": 10,
            "availability": "in-stock"
          }
        },
        "relationships": {
          "files": {
            "data": [
              {
                "type": "file",
                "id": "c6311259-02b4-4e4c-8ca2-989f24b4acf5"
              },
              {
                "type": "file",
                "id": "8024fd79-03cd-489d-a8ad-6e54c53d324e"
              }
            ]
          },
          "categories": {
            "data": [
              {
                "type": "category",
                "id": "d24fbadd-0067-487c-b45e-508947304906"
              },
              {
                "type": "category",
                "id": "af431233-cb8b-4a50-8e73-88e159974d60"
              },
              {
                "type": "category",
                "id": "72121393-169a-4609-847d-859c2d97b4ac"
              }
            ]
          },
          "collections": {
            "data": [
              {
                "type": "collection",
                "id": "cdaadc9f-4657-475b-9b6a-e21a0c5322a9"
              }
            ]
          },
          "brands": {
            "data": [
              {
                "type": "brand",
                "id": "c7f240a5-46af-44ba-9a61-95270827bfb2"
              }
            ]
          },
          "main_image": {
            "data": {
              "type": "main_image",
              "id": "0b977907-a178-4431-ac15-02d43b8c149e"
            }
          }
        },
        "rating": 4,
        "discount": 0,
        "color": "Pumice",
        "fit": "Skinny",
        "newArrival": null,
        "reviews": 10,
        "colorCode": "beige",
        "mainImage": null,
        "brand": "Polo Ralph Lauren"
      },
      {
        "type": "product",
        "id": "7b899728-2a36-4bf5-b816-99a773e999ef",
        "name": "THOMMER TROUSERS - JEANS",
        "slug": "DIM00SW1R",
        "sku": "DIM00SW1R",
        "manage_stock": true,
        "description": "72% cotton, 17% polyester, 9% viscose, 2% elastane\nLow-rise fit\nButton and zip closure\nClassic 5 pocket styling\nFine wash at max. 30˚C\nMade in Italy",
        "price": [
          {
            "amount": 1500,
            "currency": "SEK",
            "includes_tax": true
          }
        ],
        "status": "live",
        "commodity_type": "physical",
        "meta": {
          "timestamps": {
            "created_at": "2018-04-30T16:56:55+00:00",
            "updated_at": "2018-04-30T17:04:25+00:00"
          },
          "display_price": {
            "with_tax": {
              "amount": 1500,
              "currency": "SEK",
              "formatted": "1,500 kr"
            },
            "without_tax": {
              "amount": 1500,
              "currency": "SEK",
              "formatted": "1,500 kr"
            }
          },
          "stock": {
            "level": 15,
            "availability": "in-stock"
          }
        },
        "relationships": {
          "files": {
            "data": [
              {
                "type": "file",
                "id": "f20f3033-9ac6-4671-ad16-8f085bbacc14"
              },
              {
                "type": "file",
                "id": "a2267f4d-a353-415e-90fd-21dc74b0fdbd"
              }
            ]
          },
          "categories": {
            "data": [
              {
                "type": "category",
                "id": "d24fbadd-0067-487c-b45e-508947304906"
              },
              {
                "type": "category",
                "id": "af431233-cb8b-4a50-8e73-88e159974d60"
              },
              {
                "type": "category",
                "id": "72121393-169a-4609-847d-859c2d97b4ac"
              }
            ]
          },
          "collections": {
            "data": [
              {
                "type": "collection",
                "id": "cdaadc9f-4657-475b-9b6a-e21a0c5322a9"
              }
            ]
          },
          "brands": {
            "data": [
              {
                "type": "brand",
                "id": "45a50303-f9ba-4b0d-b50f-317c8691ac8a"
              }
            ]
          },
          "main_image": {
            "data": {
              "type": "main_image",
              "id": "7301b6f9-7898-4e0f-ad2e-d25bacf48ac8"
            }
          }
        },
        "rating": 5,
        "discount": 30,
        "color": "Denim",
        "fit": "Skinny",
        "newArrival": false,
        "reviews": 27,
        "colorCode": "blue",
        "mainImage": null,
        "brand": "Diesel"
      },
      {
        "type": "product",
        "id": "f72413bc-ed5f-4983-86b1-3e1e94a2c4ac",
        "name": "AMR FINE TAPE",
        "slug": "HACHM562106",
        "sku": "HACHM562106",
        "manage_stock": true,
        "description": "97% cotton, 3% elastane\nAthletic style\nPolo collar and button placket\nStripes on the sleeves\nPrinted graphic",
        "price": [
          {
            "amount": 999,
            "currency": "SEK",
            "includes_tax": true
          }
        ],
        "status": "live",
        "commodity_type": "physical",
        "meta": {
          "timestamps": {
            "created_at": "2018-04-30T06:09:12+00:00",
            "updated_at": "2018-04-30T06:54:44+00:00"
          },
          "display_price": {
            "with_tax": {
              "amount": 999,
              "currency": "SEK",
              "formatted": "999 kr"
            },
            "without_tax": {
              "amount": 999,
              "currency": "SEK",
              "formatted": "999 kr"
            }
          },
          "stock": {
            "level": 11,
            "availability": "in-stock"
          }
        },
        "relationships": {
          "files": {
            "data": [
              {
                "type": "file",
                "id": "fc2b22cf-ff44-4a55-a21d-987af927c62a"
              },
              {
                "type": "file",
                "id": "dce08591-f90b-4243-b432-2012c46ee773"
              },
              {
                "type": "file",
                "id": "b101fbef-f5eb-446c-a205-10d8e2f72df6"
              }
            ]
          },
          "categories": {
            "data": [
              {
                "type": "category",
                "id": "d24fbadd-0067-487c-b45e-508947304906"
              },
              {
                "type": "category",
                "id": "f6f964fb-4b23-47df-a0c1-208a93afdfb9"
              },
              {
                "type": "category",
                "id": "da74a240-3e42-46f0-9ee5-a6863c15e1bf"
              }
            ]
          },
          "collections": {
            "data": [
              {
                "type": "collection",
                "id": "cdaadc9f-4657-475b-9b6a-e21a0c5322a9"
              }
            ]
          },
          "brands": {
            "data": [
              {
                "type": "brand",
                "id": "3b138c3e-88de-4e58-8f03-ae174a6a7894"
              }
            ]
          },
          "main_image": {
            "data": {
              "type": "main_image",
              "id": "e7c2665a-7b24-48f2-a3fc-91d88ca9f817"
            }
          }
        },
        "rating": 3,
        "discount": 0,
        "color": "Navy",
        "fit": "Regular",
        "newArrival": true,
        "reviews": 0,
        "colorCode": "blue",
        "mainImage": null,
        "brand": "Hackett"
      },
      {
        "type": "product",
        "id": "080a6b90-6965-47ff-9f3f-edcb0986a18b",
        "name": "MINI LEE LOGO TEE",
        "slug": "LJSL62RRE01",
        "sku": "LJSL62RRE01",
        "manage_stock": true,
        "description": "100% cotton\nComfortable fit\nRound neckline\nVintage inspired\nFine wash at max. 30˚C",
        "price": [
          {
            "amount": 299,
            "currency": "SEK",
            "includes_tax": true
          }
        ],
        "status": "live",
        "commodity_type": "physical",
        "meta": {
          "timestamps": {
            "created_at": "2018-04-29T18:31:04+00:00",
            "updated_at": "2018-04-29T18:36:50+00:00"
          },
          "display_price": {
            "with_tax": {
              "amount": 299,
              "currency": "SEK",
              "formatted": "299 kr"
            },
            "without_tax": {
              "amount": 299,
              "currency": "SEK",
              "formatted": "299 kr"
            }
          },
          "stock": {
            "level": 5,
            "availability": "in-stock"
          }
        },
        "relationships": {
          "files": {
            "data": [
              {
                "type": "file",
                "id": "94a12ddc-5b90-49c1-85e4-3bceacb26d2f"
              },
              {
                "type": "file",
                "id": "5c505e21-2dcd-4e3d-bc58-ac35abbe9537"
              }
            ]
          },
          "categories": {
            "data": [
              {
                "type": "category",
                "id": "d24fbadd-0067-487c-b45e-508947304906"
              },
              {
                "type": "category",
                "id": "eddbc2ee-7ef8-4f32-a2fe-d46635bbfcac"
              },
              {
                "type": "category",
                "id": "f6f964fb-4b23-47df-a0c1-208a93afdfb9"
              }
            ]
          },
          "collections": {
            "data": [
              {
                "type": "collection",
                "id": "cdaadc9f-4657-475b-9b6a-e21a0c5322a9"
              }
            ]
          },
          "brands": {
            "data": [
              {
                "type": "brand",
                "id": "cf7c9204-9eb9-43ad-bd0c-30637f3a82df"
              }
            ]
          },
          "main_image": {
            "data": {
              "type": "main_image",
              "id": "7f1bf47c-ace7-48c4-88e5-920a57d65a0c"
            }
          }
        },
        "rating": 4,
        "discount": 25,
        "color": "Black",
        "fit": "Slim-fit",
        "newArrival": null,
        "reviews": 0,
        "colorCode": "black",
        "mainImage": null,
        "brand": "Lee Jeans"
      },
      {
        "type": "product",
        "id": "36fba812-e889-47a1-bf0f-927f52566973",
        "name": "Les Deux T-Shirt",
        "slug": "LESLDM101001",
        "sku": "LESLDM101001",
        "manage_stock": true,
        "description": "100% cotton\nCrew neckline\nFine wash at max. 40˚C\nMade in Portugal",
        "price": [
          {
            "amount": 449,
            "currency": "SEK",
            "includes_tax": true
          }
        ],
        "status": "live",
        "commodity_type": "physical",
        "meta": {
          "timestamps": {
            "created_at": "2018-04-29T18:15:44+00:00",
            "updated_at": "2018-04-29T18:21:19+00:00"
          },
          "display_price": {
            "with_tax": {
              "amount": 449,
              "currency": "SEK",
              "formatted": "449 kr"
            },
            "without_tax": {
              "amount": 449,
              "currency": "SEK",
              "formatted": "449 kr"
            }
          },
          "stock": {
            "level": 50,
            "availability": "in-stock"
          }
        },
        "relationships": {
          "files": {
            "data": [
              {
                "type": "file",
                "id": "34cd21d9-6db5-43f0-9f12-f4f400bde80f"
              },
              {
                "type": "file",
                "id": "5a75ea20-a392-4c5f-b64f-6477fda2d2bc"
              }
            ]
          },
          "categories": {
            "data": [
              {
                "type": "category",
                "id": "d24fbadd-0067-487c-b45e-508947304906"
              },
              {
                "type": "category",
                "id": "eddbc2ee-7ef8-4f32-a2fe-d46635bbfcac"
              },
              {
                "type": "category",
                "id": "f6f964fb-4b23-47df-a0c1-208a93afdfb9"
              }
            ]
          },
          "collections": {
            "data": [
              {
                "type": "collection",
                "id": "cdaadc9f-4657-475b-9b6a-e21a0c5322a9"
              }
            ]
          },
          "brands": {
            "data": [
              {
                "type": "brand",
                "id": "11820a98-d2a3-4368-bf7f-cce3e136ba69"
              }
            ]
          },
          "main_image": {
            "data": {
              "type": "main_image",
              "id": "67a742a1-ebe8-4053-800f-360e32d3d255"
            }
          }
        },
        "rating": 4,
        "discount": 25,
        "color": "Snow Gray",
        "fit": "Regular",
        "newArrival": true,
        "reviews": 0,
        "colorCode": "gray",
        "mainImage": null,
        "brand": "Les Deux"
      },
      {
        "type": "product",
        "id": "3e5a0908-8c5e-4f97-a8f4-54b44ca3bbd4",
        "name": "Slim Fit Oxford Shirt",
        "slug": "RAF710684870",
        "sku": "RAF710684870",
        "manage_stock": true,
        "description": "100% cotton\nClassic design\nFront button closure\nButton down collar\nFine wash at max. 40˚C",
        "price": [
          {
            "amount": 995,
            "currency": "SEK",
            "includes_tax": true
          }
        ],
        "status": "live",
        "commodity_type": "physical",
        "meta": {
          "timestamps": {
            "created_at": "2018-04-29T18:03:38+00:00",
            "updated_at": "2018-04-30T06:42:23+00:00"
          },
          "display_price": {
            "with_tax": {
              "amount": 995,
              "currency": "SEK",
              "formatted": "995 kr"
            },
            "without_tax": {
              "amount": 995,
              "currency": "SEK",
              "formatted": "995 kr"
            }
          },
          "stock": {
            "level": 15,
            "availability": "in-stock"
          }
        },
        "relationships": {
          "files": {
            "data": [
              {
                "type": "file",
                "id": "4b96dff3-8bab-4f2a-a0a1-caee70f2cebc"
              },
              {
                "type": "file",
                "id": "002aea77-28ea-4a1b-a6f8-24983d41c3ed"
              }
            ]
          },
          "categories": {
            "data": [
              {
                "type": "category",
                "id": "d24fbadd-0067-487c-b45e-508947304906"
              },
              {
                "type": "category",
                "id": "c4ee90ce-b92c-4a72-8a0c-948e174dab76"
              },
              {
                "type": "category",
                "id": "f6f964fb-4b23-47df-a0c1-208a93afdfb9"
              }
            ]
          },
          "collections": {
            "data": [
              {
                "type": "collection",
                "id": "cdaadc9f-4657-475b-9b6a-e21a0c5322a9"
              }
            ]
          },
          "brands": {
            "data": [
              {
                "type": "brand",
                "id": "c7f240a5-46af-44ba-9a61-95270827bfb2"
              }
            ]
          },
          "main_image": {
            "data": {
              "type": "main_image",
              "id": "3c23157a-0541-4f28-b028-7847b01e1853"
            }
          }
        },
        "rating": 5,
        "discount": 30,
        "color": "White",
        "fit": "Slim-fit",
        "newArrival": true,
        "reviews": 2,
        "colorCode": "white",
        "mainImage": null,
        "brand": "Polo Ralph Lauren"
      },
      {
        "type": "product",
        "id": "ff439efe-b484-4770-b61c-46fad5895517",
        "name": "LEE BUTTON DOWN SS",
        "slug": "LJSL886GDEE",
        "sku": "LJSL886GDEE",
        "manage_stock": true,
        "description": "100% cotton\nMinimalist design\nButton at the front\nButton down collar\nRounded sheep",
        "price": [
          {
            "amount": 599,
            "currency": "SEK",
            "includes_tax": true
          }
        ],
        "status": "live",
        "commodity_type": "physical",
        "meta": {
          "timestamps": {
            "created_at": "2018-04-29T17:45:23+00:00",
            "updated_at": "2018-04-29T17:57:18+00:00"
          },
          "display_price": {
            "with_tax": {
              "amount": 599,
              "currency": "SEK",
              "formatted": "599 kr"
            },
            "without_tax": {
              "amount": 599,
              "currency": "SEK",
              "formatted": "599 kr"
            }
          },
          "stock": {
            "level": 35,
            "availability": "in-stock"
          }
        },
        "relationships": {
          "files": {
            "data": [
              {
                "type": "file",
                "id": "250408c9-74b0-4e8e-911c-bc0ba8f008f2"
              },
              {
                "type": "file",
                "id": "dfd02267-43b4-4b25-aba1-5f4ef3ede85b"
              }
            ]
          },
          "categories": {
            "data": [
              {
                "type": "category",
                "id": "d24fbadd-0067-487c-b45e-508947304906"
              },
              {
                "type": "category",
                "id": "f6f964fb-4b23-47df-a0c1-208a93afdfb9"
              },
              {
                "type": "category",
                "id": "c4ee90ce-b92c-4a72-8a0c-948e174dab76"
              }
            ]
          },
          "collections": {
            "data": [
              {
                "type": "collection",
                "id": "cdaadc9f-4657-475b-9b6a-e21a0c5322a9"
              }
            ]
          },
          "brands": {
            "data": [
              {
                "type": "brand",
                "id": "cf7c9204-9eb9-43ad-bd0c-30637f3a82df"
              }
            ]
          },
          "main_image": {
            "data": {
              "type": "main_image",
              "id": "6bd89abf-abc5-4980-8c50-bf72a5a3298c"
            }
          }
        },
        "rating": 4,
        "discount": 20,
        "color": "Navy Drop",
        "fit": "Classic/ Regular",
        "newArrival": null,
        "reviews": 10,
        "colorCode": "blue",
        "mainImage": null,
        "brand": "LEE JEANS"
      },
      {
        "type": "product",
        "id": "aaf0ff45-a1ce-456e-9672-f3d67f4fd6a5",
        "name": "Paddy - PIKÉER",
        "slug": "BOG50302557",
        "sku": "BOG50302557",
        "manage_stock": true,
        "description": "100% cotton\nClassic design\nPiké krage with button lid\nStriped details\nMachine wash at no more than 30 ˚C in soft washing programs. Half full-centrifuged machine is recommended",
        "price": [
          {
            "amount": 999,
            "currency": "SEK",
            "includes_tax": true
          }
        ],
        "status": "live",
        "commodity_type": "physical",
        "meta": {
          "timestamps": {
            "created_at": "2018-04-23T05:51:27+00:00",
            "updated_at": "2018-04-23T06:01:54+00:00"
          },
          "display_price": {
            "with_tax": {
              "amount": 999,
              "currency": "SEK",
              "formatted": "999 kr"
            },
            "without_tax": {
              "amount": 999,
              "currency": "SEK",
              "formatted": "999 kr"
            }
          },
          "stock": {
            "level": 20,
            "availability": "in-stock"
          }
        },
        "relationships": {
          "files": {
            "data": [
              {
                "type": "file",
                "id": "ae1bbc82-380a-492e-bdf1-2e043a6c0e3a"
              },
              {
                "type": "file",
                "id": "b6e7ee0d-1418-4472-942a-6f741c31a05c"
              }
            ]
          },
          "categories": {
            "data": [
              {
                "type": "category",
                "id": "d24fbadd-0067-487c-b45e-508947304906"
              },
              {
                "type": "category",
                "id": "f6f964fb-4b23-47df-a0c1-208a93afdfb9"
              },
              {
                "type": "category",
                "id": "da74a240-3e42-46f0-9ee5-a6863c15e1bf"
              }
            ]
          },
          "collections": {
            "data": [
              {
                "type": "collection",
                "id": "cdaadc9f-4657-475b-9b6a-e21a0c5322a9"
              }
            ]
          },
          "brands": {
            "data": [
              {
                "type": "brand",
                "id": "858828e3-b0e3-46a8-8aa4-8dff6c2cc076"
              }
            ]
          },
          "main_image": {
            "data": {
              "type": "main_image",
              "id": "4079bc50-1513-42f2-8a26-42a6fa508c26"
            }
          }
        },
        "rating": 5,
        "discount": 0,
        "color": "Dark Blue",
        "fit": "Regular",
        "newArrival": true,
        "reviews": 5,
        "colorCode": "blue",
        "mainImage": "none",
        "brand": "Boss"
      },
      {
        "type": "product",
        "id": "c0802b48-8f95-41da-b979-a3f555140784",
        "name": "Maasai o-n 9670",
        "slug": "SAMM_18122304",
        "sku": "SAMM_18122304",
        "manage_stock": true,
        "description": "Fit: Regular\nMaterial: 100% cotton.\nCrew neck\nRibbed knit texture pattern\nContrast trim\nFine wash at max. 30˚C",
        "price": [
          {
            "amount": 990,
            "currency": "SEK",
            "includes_tax": true
          }
        ],
        "status": "live",
        "commodity_type": "physical",
        "meta": {
          "timestamps": {
            "created_at": "2018-04-14T10:58:02+00:00",
            "updated_at": "2018-04-14T18:03:24+00:00"
          },
          "display_price": {
            "with_tax": {
              "amount": 990,
              "currency": "SEK",
              "formatted": "990 kr"
            },
            "without_tax": {
              "amount": 990,
              "currency": "SEK",
              "formatted": "990 kr"
            }
          },
          "stock": {
            "level": 5,
            "availability": "in-stock"
          }
        },
        "relationships": {
          "files": {
            "data": [
              {
                "type": "file",
                "id": "47327a7b-3c3b-4ba6-b164-3a28159f2017"
              }
            ]
          },
          "categories": {
            "data": [
              {
                "type": "category",
                "id": "d24fbadd-0067-487c-b45e-508947304906"
              },
              {
                "type": "category",
                "id": "c136df12-476c-4491-a4f1-5a42a6574a38"
              },
              {
                "type": "category",
                "id": "f6f964fb-4b23-47df-a0c1-208a93afdfb9"
              }
            ]
          },
          "collections": {
            "data": [
              {
                "type": "collection",
                "id": "cdaadc9f-4657-475b-9b6a-e21a0c5322a9"
              }
            ]
          },
          "brands": {
            "data": [
              {
                "type": "brand",
                "id": "85d0308a-8b82-423c-b2b0-87800d9e9862"
              }
            ]
          },
          "main_image": {
            "data": {
              "type": "main_image",
              "id": "9955ba31-1df1-4efa-ac97-89a8f80df76f"
            }
          }
        },
        "rating": 4,
        "discount": 20,
        "color": "Dark Sapphire",
        "fit": "Regular",
        "newArrival": false,
        "reviews": 7,
        "colorCode": "black",
        "mainImage": "https://s3-eu-west-1.amazonaws.com/bkt-svc-files-cmty-api-moltin-com/ee5732a5-0d9a-484f-b2ad-ee6b9ba92850/9955ba31-1df1-4efa-ac97-89a8f80df76f.jpg",
        "brand": "SAMSØE & SAMSØE"
      },
      {
        "type": "product",
        "id": "200ad926-9563-4242-bb51-45de3898e1cc",
        "name": "Maasai o-n 9670",
        "slug": "SAMM_18122303",
        "sku": "SAMM_18122303",
        "manage_stock": true,
        "description": "100% cotton\nCrew neck\nRibbed knit texture pattern\nContrast trim\nFine wash at max. 30˚C\nItem number: 16055535\nSKU: SAMM18122303\nID: 16055529",
        "price": [
          {
            "amount": 990,
            "currency": "SEK",
            "includes_tax": true
          }
        ],
        "status": "live",
        "commodity_type": "physical",
        "meta": {
          "timestamps": {
            "created_at": "2018-04-14T10:51:34+00:00",
            "updated_at": "2018-04-14T19:16:37+00:00"
          },
          "display_price": {
            "with_tax": {
              "amount": 990,
              "currency": "SEK",
              "formatted": "990 kr"
            },
            "without_tax": {
              "amount": 990,
              "currency": "SEK",
              "formatted": "990 kr"
            }
          },
          "stock": {
            "level": 10,
            "availability": "in-stock"
          }
        },
        "relationships": {
          "files": {
            "data": [
              {
                "type": "file",
                "id": "9333e56e-a8cb-46ee-b2f1-aeeba6233466"
              }
            ]
          },
          "categories": {
            "data": [
              {
                "type": "category",
                "id": "d24fbadd-0067-487c-b45e-508947304906"
              },
              {
                "type": "category",
                "id": "c136df12-476c-4491-a4f1-5a42a6574a38"
              },
              {
                "type": "category",
                "id": "f6f964fb-4b23-47df-a0c1-208a93afdfb9"
              }
            ]
          },
          "collections": {
            "data": [
              {
                "type": "collection",
                "id": "cdaadc9f-4657-475b-9b6a-e21a0c5322a9"
              }
            ]
          },
          "brands": {
            "data": [
              {
                "type": "brand",
                "id": "85d0308a-8b82-423c-b2b0-87800d9e9862"
              }
            ]
          },
          "main_image": {
            "data": {
              "type": "main_image",
              "id": "a93a4194-f879-4259-b9d7-dc9f354786bb"
            }
          }
        },
        "rating": 5,
        "discount": 0,
        "color": "Clear Cream",
        "fit": "Regular",
        "newArrival": true,
        "reviews": 7,
        "colorCode": "white",
        "mainImage": "https://s3-eu-west-1.amazonaws.com/bkt-svc-files-cmty-api-moltin-com/ee5732a5-0d9a-484f-b2ad-ee6b9ba92850/a93a4194-f879-4259-b9d7-dc9f354786bb.jpg",
        "brand": "SAMSØE & SAMSØE"
      },
      {
        "type": "product",
        "id": "4e124dde-2dd0-471a-8bbd-c1b64e3f5457",
        "name": "Cotton Cable Crew",
        "slug": "GCL_1000002",
        "sku": "GCL_1000002",
        "manage_stock": true,
        "description": "Fit: Regular\nMaterial: Outer fabric: cotton 100%\nOuter fabric: cotton 100%\nCable knit\nFine wash at max. 40˚C",
        "price": [
          {
            "amount": 1250,
            "currency": "SEK",
            "includes_tax": true
          }
        ],
        "status": "live",
        "commodity_type": "physical",
        "meta": {
          "timestamps": {
            "created_at": "2018-04-14T10:42:29+00:00",
            "updated_at": "2018-04-14T19:54:43+00:00"
          },
          "display_price": {
            "with_tax": {
              "amount": 1250,
              "currency": "SEK",
              "formatted": "1,250 kr"
            },
            "without_tax": {
              "amount": 1250,
              "currency": "SEK",
              "formatted": "1,250 kr"
            }
          },
          "stock": {
            "level": 15,
            "availability": "in-stock"
          }
        },
        "relationships": {
          "files": {
            "data": [
              {
                "type": "file",
                "id": "5b6c5890-7e2b-40d6-bca1-7a0675b28024"
              },
              {
                "type": "file",
                "id": "2a9f4c21-f53d-416f-a1b2-0d4694ec13aa"
              }
            ]
          },
          "categories": {
            "data": [
              {
                "type": "category",
                "id": "d24fbadd-0067-487c-b45e-508947304906"
              },
              {
                "type": "category",
                "id": "c136df12-476c-4491-a4f1-5a42a6574a38"
              },
              {
                "type": "category",
                "id": "f6f964fb-4b23-47df-a0c1-208a93afdfb9"
              }
            ]
          },
          "collections": {
            "data": [
              {
                "type": "collection",
                "id": "cdaadc9f-4657-475b-9b6a-e21a0c5322a9"
              }
            ]
          },
          "brands": {
            "data": [
              {
                "type": "brand",
                "id": "1e0240ab-53fa-4f30-acef-b361754616d1"
              }
            ]
          },
          "main_image": {
            "data": {
              "type": "main_image",
              "id": "ef14e8ce-d86e-4dca-9cba-95ff81f748e7"
            }
          }
        },
        "rating": 5,
        "discount": 10,
        "color": "Sand Melange",
        "fit": "Regular",
        "newArrival": false,
        "reviews": 16,
        "colorCode": "brown",
        "mainImage": "https://s3-eu-west-1.amazonaws.com/bkt-svc-files-cmty-api-moltin-com/ee5732a5-0d9a-484f-b2ad-ee6b9ba92850/ef14e8ce-d86e-4dca-9cba-95ff81f748e7.jpg",
        "brand": "Gant"
      },
      {
        "type": "product",
        "id": "3ddd02b6-3575-408e-a59b-1be90e12cb3d",
        "name": "Cotton Cable Crew",
        "slug": "GCL_1000001",
        "sku": "GCL_1000001",
        "manage_stock": true,
        "description": "Fit: Regular\nMaterial: Outer fabric: cotton 100%\nOuter fabric: cotton 100%\nCable knit\nFine wash at max. 40˚C",
        "price": [
          {
            "amount": 1500,
            "currency": "SEK",
            "includes_tax": true
          }
        ],
        "status": "live",
        "commodity_type": "physical",
        "meta": {
          "timestamps": {
            "created_at": "2018-04-14T10:38:14+00:00",
            "updated_at": "2018-04-14T19:54:50+00:00"
          },
          "display_price": {
            "with_tax": {
              "amount": 1500,
              "currency": "SEK",
              "formatted": "1,500 kr"
            },
            "without_tax": {
              "amount": 1500,
              "currency": "SEK",
              "formatted": "1,500 kr"
            }
          },
          "stock": {
            "level": 25,
            "availability": "in-stock"
          }
        },
        "relationships": {
          "files": {
            "data": [
              {
                "type": "file",
                "id": "157c84df-c237-40db-8328-8af591e496b5"
              },
              {
                "type": "file",
                "id": "9668e5f5-4a12-4448-99e0-e195b59ad233"
              }
            ]
          },
          "categories": {
            "data": [
              {
                "type": "category",
                "id": "d24fbadd-0067-487c-b45e-508947304906"
              },
              {
                "type": "category",
                "id": "c136df12-476c-4491-a4f1-5a42a6574a38"
              },
              {
                "type": "category",
                "id": "f6f964fb-4b23-47df-a0c1-208a93afdfb9"
              }
            ]
          },
          "collections": {
            "data": [
              {
                "type": "collection",
                "id": "cdaadc9f-4657-475b-9b6a-e21a0c5322a9"
              }
            ]
          },
          "brands": {
            "data": [
              {
                "type": "brand",
                "id": "1e0240ab-53fa-4f30-acef-b361754616d1"
              }
            ]
          },
          "main_image": {
            "data": {
              "type": "main_image",
              "id": "9ec801f4-8f0b-4006-a75d-8ae896d1e217"
            }
          }
        },
        "rating": 4,
        "discount": 0,
        "color": "Yale Blue",
        "fit": "Regular",
        "newArrival": false,
        "reviews": 10,
        "colorCode": "blue",
        "mainImage": "https://s3-eu-west-1.amazonaws.com/bkt-svc-files-cmty-api-moltin-com/ee5732a5-0d9a-484f-b2ad-ee6b9ba92850/9ec801f4-8f0b-4006-a75d-8ae896d1e217.jpg",
        "brand": "Gant"
      },
      {
        "type": "product",
        "id": "be5a48e7-40ee-43c9-bfe3-f0e12af65169",
        "name": "Cotton Cable Crew",
        "slug": "GCL_1000000",
        "sku": "GCL_1000000",
        "manage_stock": true,
        "description": "Fit: Regular\nMaterial: Outer fabric: cotton 100%\nOuter fabric: cotton 100%\nCable knit\nFine wash at max. 40˚C",
        "price": [
          {
            "amount": 1500,
            "currency": "SEK",
            "includes_tax": true
          }
        ],
        "status": "live",
        "commodity_type": "physical",
        "meta": {
          "timestamps": {
            "created_at": "2018-04-13T04:42:06+00:00",
            "updated_at": "2018-04-21T19:23:57+00:00"
          },
          "display_price": {
            "with_tax": {
              "amount": 1500,
              "currency": "SEK",
              "formatted": "1,500 kr"
            },
            "without_tax": {
              "amount": 1500,
              "currency": "SEK",
              "formatted": "1,500 kr"
            }
          },
          "stock": {
            "level": 0,
            "availability": "out-stock"
          }
        },
        "relationships": {
          "files": {
            "data": [
              {
                "type": "file",
                "id": "0e868183-ba1a-4ad0-9a1d-6083ebdbb811"
              },
              {
                "type": "file",
                "id": "7dc2f96b-3020-404b-a49c-8209893b5e01"
              }
            ]
          },
          "categories": {
            "data": [
              {
                "type": "category",
                "id": "c136df12-476c-4491-a4f1-5a42a6574a38"
              },
              {
                "type": "category",
                "id": "f6f964fb-4b23-47df-a0c1-208a93afdfb9"
              },
              {
                "type": "category",
                "id": "d24fbadd-0067-487c-b45e-508947304906"
              }
            ]
          },
          "collections": {
            "data": [
              {
                "type": "collection",
                "id": "cdaadc9f-4657-475b-9b6a-e21a0c5322a9"
              }
            ]
          },
          "brands": {
            "data": [
              {
                "type": "brand",
                "id": "1e0240ab-53fa-4f30-acef-b361754616d1"
              }
            ]
          },
          "main_image": {
            "data": {
              "type": "main_image",
              "id": "88cbb6c3-a294-47f1-8116-574d5f2232f3"
            }
          }
        },
        "rating": 5,
        "discount": 0,
        "color": "Pacific Blue",
        "fit": "Regular",
        "newArrival": true,
        "reviews": 17,
        "colorCode": "blue",
        "mainImage": "https://s3-eu-west-1.amazonaws.com/bkt-svc-files-cmty-api-moltin-com/ee5732a5-0d9a-484f-b2ad-ee6b9ba92850/6f0f7c2c-6db0-447e-999a-8a7b0174cbcb.jpg",
        "brand": "Gant"
      }
    ]
  }
}
