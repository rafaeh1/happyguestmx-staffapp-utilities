'use strict';

const AWS = require('aws-sdk'),
    env = process.env;

AWS.config.update({
    region: env.REGION
});

const cognito = new AWS.CognitoIdentityServiceProvider(),
    dynamodbDocumentClient = new AWS.DynamoDB.DocumentClient();

async function getUserFromJWT(AccessToken) {
    try {
        let user = await cognito.getUser({
            AccessToken
        }).promise();
        const sub = user["UserAttributes"][0].Value;
        user = await findUserInDB(sub);
        return user;
    } catch (err) {
        throw (err);
    }
};

async function findUserInDB(sub) {
    try {
        const concierge = await finUserInConciergeUsers(sub);
        if (concierge.Count > 0) return concierge.Items[0];
        const admin = await finUserInAdminUsers(sub);
        if (admin.Count > 0) return admin.Items[0];
        const co_staff = await finUserInCoStaffUsers(sub);
        if (co_staff.Count > 0) return co_staff.Items[0];
        const staff = await finUserInStaffUsers(sub);
        if (staff.Count > 0) return staff.Items[0];

        if (concierge.Count === 0 &&
            admin.Count === 0 &&
            co_staff.Count === 0 &&
            staff.Count === 0) throw 'User does not exist';

    } catch (err) {
        throw (err);
    }
};

async function finUserInAdminUsers(uuid, fields = []) {
    try {
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
        console.log('params: ', params);
        if (fields.length > 0) {
            params = await pushParamstoObject(fields, params);
        }
        const res = await dynamodbDocumentClient.query(params).promise();
        return res;
    } catch (err) {
        throw (err);
    }
};

async function finUserInStaffUsers(sub) {
    try {
        const params = {
            TableName: env.DDB_STAFF_USERS_TABLE,
            KeyConditionExpression: '#uuid = :uuid',
            ExpressionAttributeNames: {
                '#uuid': 'uuid'
            },
            ExpressionAttributeValues: {
                ':uuid': sub
            }
        };
        return await dynamodbDocumentClient.query(params).promise();
    } catch (err) {
        throw (err);
    }
};

async function finUserInCoStaffUsers(sub) {
    try {
        const params = {
            TableName: env.DDB_CO_STAFF_USERS_TABLE,
            KeyConditionExpression: '#uuid = :uuid',
            IndexName: 'uuid-index',
            ExpressionAttributeNames: {
                '#uuid': 'uuid'
            },
            ExpressionAttributeValues: {
                ':uuid': sub
            }
        };
        return await dynamodbDocumentClient.query(params).promise();
    } catch (err) {
        throw (err);
    }
};

async function finUserInConciergeUsers(sub) {
    try {
        const params = {
            TableName: env.DDB_HOTEL_CONCIERGES,
            KeyConditionExpression: '#uuid = :uuid',
            IndexName: 'uuid-index',
            ExpressionAttributeNames: {
                '#uuid': 'uuid'
            },
            ExpressionAttributeValues: {
                ':uuid': sub
            }
        };
        return await dynamodbDocumentClient.query(params).promise();
    } catch (err) {
        throw (err);
    }
};

async function getCognitoUser(AccessToken) {
    try {
        return await cognito.getUser({
            AccessToken
        }).promise();
    } catch (err) {
        throw (err);
    }
};

async function pushParamstoObject(arr, object) {
    try {
        let params = object;
        if (!params.ProjectionExpression) params.ProjectionExpression = '';
        if (!params.ExpressionAttributeNames) params.ExpressionAttributeNames = {};
        arr.forEach((value, index) => {
            params.ProjectionExpression += `#${value}`;
            params.ProjectionExpression += index < arr.length - 1 ? ',' : '';
            params['ExpressionAttributeNames'][`#${value}`] = value;
        });
        return params;
    } catch (err) {
        throw (err);
    }
}

async function cognitoAttributesToJson(arr) {
    try {
        let obj = {}
        for (const item of arr) obj[item.Name] = item.Value
        return obj
    } catch (err) {
        throw (err);
    }
}

module.exports = {
    getUserFromJWT,
    findUserInDB,
    getCognitoUser,
    finUserInAdminUsers,
    finUserInStaffUsers,
    finUserInCoStaffUsers,
    finUserInConciergeUsers,
    cognitoAttributesToJson
}