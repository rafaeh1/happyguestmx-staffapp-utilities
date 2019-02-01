//ver 0.3

'use strict';
const AWS = require('aws-sdk'),
    env = process.env;

AWS.config.update({
    region: env.REGION
});
//services
const cognito = new AWS.CognitoIdentityServiceProvider(),
    dynamodbDocumentClient = new AWS.DynamoDB.DocumentClient();

var not_found_error = {
    "message": "Resource not found",
    "code": "ValidationException",
    "statusCode": 404
};

var user = module.exports = {};

user.getUserFromJWT = function (AccessToken, fields = []) {
    return new Promise((resolve, reject) => {
        let locale;
        let user;
        this.getCognitoUser(AccessToken)
            .then((data) => {
                let sub = data["UserAttributes"][0].Value;
                return this.getUserFromTable(sub, fields);
            })
            .then((data) => {
                user = data;
                return this.getUserRelations(data);
            })
            .then((data) => {
                user.hotels = data;
                resolve(user);
            })
            .catch((err) => {
                reject(err);
            });
    });
};


user.getCognitoUser = function (AccessToken) {
    return new Promise((resolve, reject) => {
        cognito.getUser({
                AccessToken: AccessToken
            })
            .promise()
            .then((data) => {
                resolve(data);
            })
            .catch((err) => {
                reject(err);
            });
    });
};

user.getUserFromTable = function (uuid, fields = []) {
    return new Promise((resolve, reject) => {
        let params = {
            TableName: env.DBB_ADMIN_USERS_TABLE,
            IndexName: 'uuid-index',
            KeyConditionExpression: '#uuid = :uuid',
            ExpressionAttributeValues: {
                ':uuid': uuid
            },
            ExpressionAttributeNames: {
                '#uuid': 'uuid'
            }
        };
        if (fields.length > 0) {
            params = pushParamstoObject(fields, params);
        }
        dynamodbDocumentClient.query(params).promise()
            .then((data) => {
                if (data.Count > 0) resolve(data.Items[0]);
                else reject(not_found_error);
            })
            .catch((err) => {
                reject(err);
            });
    });
};

user.getUserRelations = function (user) {
    return new Promise((resolve, reject) => {
        let params = {
            TableName: env.DDB_HOTELS_USERS,
            ProjectionExpression: 'hotel_uuid',
            IndexName: 'company_uuid-index',
            KeyConditionExpression: 'company_uuid = :company_uuid',
            FilterExpression: 'user_uuid = :user_uuid',
            ExpressionAttributeValues: {
                ':company_uuid': user.company_uuid,
                ':user_uuid': user.uuid
            }
        }
        dynamodbDocumentClient.query(params).promise().then((data) => {
            let response = [];
            if (data.Count > 0) {
                data.Items.forEach((hotel) => {
                    response.push(hotel.hotel_uuid);
                });
            }
            resolve(response);
        }).catch((err) => {
            reject(err);
        });
    });
}

user.cognitoUserAsJson = function (AccessToken) {
    return new Promise((resolve, reject) => {
        let cognitoUser = {};
        cognito.getUser({
                AccessToken: AccessToken
            })
            .promise()
            .then((user) => {
                user.UserAttributes.forEach((attribute) => {
                    cognitoUser[attribute.Name] = attribute.Value;
                });
                resolve(cognitoUser);
            })
            .catch((err) => {
                reject(err);
            });
    });
};

function objectIsEmpty(obj) {
    for (var key in obj) {
        if (obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

function pushParamstoObject(arr, object) {
    let params = object;
    if (!params.ProjectionExpression) params.ProjectionExpression = '';
    if (!params.ExpressionAttributeNames) params.ExpressionAttributeNames = {};
    arr.forEach((value, index) => {
        params.ProjectionExpression += `#${value}`;
        params.ProjectionExpression += index < arr.length - 1 ? ',' : '';
        params['ExpressionAttributeNames'][`#${value}`] = value;
    });
    return params;
}

//ToDo add async await