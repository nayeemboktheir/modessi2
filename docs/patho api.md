Published using Google Docs

[Report abuse](https://docs.google.com/document/u/0/d/e/2PACX-1vTi0sTyR353xu1AK0nR8E_WKe5onCkUXGEf8ch8uoJy9qxGfgGnboSIkNosjQ0OOdXkJhgGuAsWxnIh/abuse?pli=1)[Learn more](https://support.google.com/docs/answer/183965 "Learn more")

API Documentation

Updated automatically every 5 minutes

![](https://docs.google.com/docs-images-rt/ALKuztboc17pk8lZlpK41Bs6ZWefgipCP6jOGhMNhkaaG-T2RVxlZOJC77MEfvlYdnbw5_uOEq3cu6s4P0k7igzipkEqhObSEfwGMy9KrfxpF1JTyTCfigm2w4K3tHmIQ2NV6o70Ag6aj4eKvNy8mBdofAlJIjx5KbIrLe-byg=s2048)

Steadfast Courier Limited

API Documentation

V1

Table of Contents

1. API Authentication Parameter
2. Placing an order
3. Bulk Order Create
4. Checking Delivery Status
5. Checking Current Balance
6. Single Return Request View
7. Get Return Requests
8. Get Payments (Recently Added)
9. Get Single Payment with Consignments (Recently Added)
10. Get Policestations (Recently Added)

1. API Authentication Parameter

|  |  |  |  |
| --- | --- | --- | --- |
| Name | Type | Description | Value |
| Api-Key | String | API Key provided by Steadfast Courier Ltd. | \*\*\*\*\*\*\*\*\*\*\*\*\*\*\* |
| Secret-Key | String | Secret Key provided by Steadfast Courier Ltd. | \*\*\*\*\*\*\*\*\*\*\*\*\*\*\* |
| Content-Type | String | Request Content Type | application/json |

Authentication parameters are required to be added at the header part of each request.

Base Url: https://portal.packzy.com/api/v1

2. Placing an order

        Path: /create\_order

        Method: Post

       Input Parameters:

|  |  |  |  |  |
| --- | --- | --- | --- | --- |
| Name | Type | MOC | Description | Example |
| invoice | string | required | Must be Unique and can be alpha-numeric including hyphens and underscores. | 12366  abc123  12abchd  Aa12-das4  a\_sdfd-wq |
| recipient\_name | string | required | Within 100 characters. | John Smith |
| recipient\_phone | string | required | Must be 11 Digits Phone number | 01234567890 |
| alternative\_phone | string | optional | Must be 11 Digits Phone number |  |
| recipient\_email | string | optional |  |  |
| recipient\_address | string | required | Recipient’s address within 250 characters. | Fla# A1, House# 17/1, Road# 3/A, Dhanmondi,  Dhaka-1209 |
| cod\_amount | numeric | required | Cash on delivery amount in BDT including all charges. Can’t be less than 0. | 1060 |
| note | string | optional | Delivery instructions or other notes. | Deliver within  3 PM |
| item\_description | string | optional | Items name and other information |  |
| total\_lot | numeric | optional | Total Lot of items |  |
| delivery\_type | numeric | optional | 0 = for home delivery, 1 = for Point Delivery/Steadfast Hub Pick Up | 0/1 |

        Yellow colour marked parameters are added newly.

Response:

{

    "status": 200,

    "message": "Consignment has been created successfully.",

    "consignment": {

        "consignment\_id": 1424107,

        "invoice": "Aa12-das4",

        "tracking\_code": "15BAEB8A",

        "recipient\_name": "John Smith",

        "recipient\_phone": "01234567890",

        "recipient\_address": "Fla# A1,House# 17/1, Road# 3/A, Dhanmondi,Dhaka-1209",

        "cod\_amount": 1060,

        "status": "in\_review",

        "note": "Deliver within 3PM",

        "created\_at": "2021-03-21T07:05:31.000000Z",

        "updated\_at": "2021-03-21T07:05:31.000000Z"

    }

}

3. Bulk Order Create

        Path: /create\_order/bulk-order

        Method: Post

Input Parameters:

|  |  |  |  |  |
| --- | --- | --- | --- | --- |
| Name | Type | MOC | Description | Example |
| data | Json | require | Maximum 500 items are allowed. Json encoded array | Given below |

        Array Keys:

$item = [

        ‘Invoice’ => ‘adbd123’

]

Example:

public function bulkCreate(){

$orders = Order::with('address')->where('status',1)->take(500)->get();

$data = array();

foreach($orders as $order){

$item = [

'invoice' => $order->id,

'recipient\_name' => $order->address ? $order->address->name : 'N/A',

'recipient\_address' => $order->address ? $order->address->address : 'N/A',

'recipient\_phone' => $order->address ? $order->address->phone : '',

'cod\_amount' => $order->due\_amount,

'note' => $order->note,

];

}

$steadfast = new Steadfast();

$result = $steadfast->bulkCreate(json\_encode($data));

return $result;

}

// Example code

public function bulkCreate($data){

                 $api\_key = '1m9mwrrwsjbrg0w';

         $secret\_key = 'y196ftazvk9s3';

         $response = Http::withHeaders([

         'Api-Key' => $api\_key,

         'Secret-Key' => $secret\_key,

         'Content-Type' => 'application/json'

         ])->post($this->base\_url.'/create\_order/bulk-order', [

                 'data' => $data,

                 ]);

         return json\_decode($response->getBody()->getContents());

         }

Result:

[

{

"invoice": "230822-1",

"recipient\_name": "John Doe",

"recipient\_address": "House 44, Road 2/A, Dhanmondi, Dhaka 1209",

"recipient\_phone": "0171111111",

"cod\_amount": "0.00",

"note": null,

"consignment\_id": 11543968,

"tracking\_code": "B025A038",

"status": "success"

},

{

"invoice": "230822-1",

"recipient\_name": "John Doe",

"recipient\_address": "House 44, Road 2/A, Dhanmondi, Dhaka 1209",

"recipient\_phone": "0171111111",

"cod\_amount": "0.00",

"note": null,

"consignment\_id": 11543969,

"tracking\_code": "B025A1DC",

"status": "success"

},

{

"invoice": "230822-1",

"recipient\_name": "John Doe",

"recipient\_address": "House 44, Road 2/A, Dhanmondi, Dhaka 1209",

"recipient\_phone": "0171111111",

"cod\_amount": "0.00",

"note": null,

"consignment\_id": 11543970,

"tracking\_code": "B025A23A",

"status": "success"

},

{

"invoice": "230822-1",

"recipient\_name": "John Doe",

"recipient\_address": "House 44, Road 2/A, Dhanmondi, Dhaka 1209",

"recipient\_phone": "0171111111",

"cod\_amount": "0.00",

"note": null,

"consignment\_id": 11543971,

"tracking\_code": "B025A3FA",

"status": "success"

},

]

If there is any error in data your will get response like

"data": [

{

"invoice": "230822-1",

"recipient\_name": "John Doe",

"recipient\_address": "House 44, Road 2/A, Dhanmondi, Dhaka 1209",

"recipient\_phone": "0171111111",

"cod\_amount": "0.00",

"note": null,

"consignment\_id": null,

"tracking\_code": null,

"status": "error"

},

]

4. Checking Delivery Status

i) By Consignment ID

                Path: /status\_by\_cid/{id}

Method: GET

        ii) By Your invoice ID

                Path: /status\_by\_invoice/{invoice}

                Method: GET

        iii) By Tracking Code

                Path: /status\_by\_trackingcode/{trackingCode}

                Method: GET

        Response:

        {

    "status": 200,

    "delivery\_status": "in\_review"

}

Delivery Statuses:

|  |  |
| --- | --- |
| Name | Description |
| pending | Consignment is not delivered or cancelled yet. |
| delivered\_approval\_pending | Consignment is delivered but waiting for admin approval. |
| partial\_delivered\_approval\_pending | Consignment is delivered partially and waiting for admin approval. |
| cancelled\_approval\_pending | Consignment is cancelled and waiting for admin approval. |
| unknown\_approval\_pending | Unknown Pending status. Need contact with the support team. |
| delivered | Consignment is delivered and balance added. |
| partial\_delivered | Consignment is partially delivered and balance added. |
| cancelled | Consignment is cancelled and balance updated. |
| hold | Consignment is held. |
| in\_review | Order is placed and waiting to be reviewed. |
| unknown | Unknown status. Need contact with the support team. |

5. Checking Current Balance

        Path: /get\_balance

        Method: GET

Response:

 {

    "status": 200,

    "current\_balance": 0

}

5. Creating Return Requests

Path: /create\_return\_request

Method: POST

|  |  |  |
| --- | --- | --- |
| Name | Type | Description |
| consignment\_id or invoice or tracking\_code | Required. Numeric or string | Consignment id or user defined invoice id or tracking code of the consignment of the requesting consignment. |
| reason | Optional.  string |  |

Status:  'pending', 'approved', 'processing', 'completed', 'cancelled'

Response :

|  |  |
| --- | --- |
| id | 1 |
| user\_id | 1 |
| consignment\_id | 10000042 |
| reason | null |
| status | pending |
| created\_at | 2025-07-30T23:11:45.000000Z |
| updated\_at | 2025-07-30T23:11:45.000000Z |

6. Single Return Request View

   Path: /get\_return\_request/{id}

Method: GET

7. Get Return Requests

Path: /get\_return\_requests
Method: GET

8. Get Payments

        Path: /payments

        Method: GET

9. Get Single Payment with Consignments
   Path: /payments/{payment\_id}

Method: GET

10. Get Policestations

Path: /police\_stations

Method: GET