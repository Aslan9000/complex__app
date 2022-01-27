const usersCollection = require('../db').db().collection("users")
const followedCollection = require('../db').db().collection("follows")
const ObjectID = require('mongodb').ObjectID
const User = require('./User')

let Follow = function(followedUsername, authorId){
    this.followedUsername = followedUsername
    this.authorId = authorId
    this.errors = []
}

Follow.prototype.cleanUp = function(){
    if(typeof(this.followedUsername) != "string"){this.followedUsername = ""}
}
Follow.prototype.validate = async function(action){
    // followedUsername must exist in db
    let followedAccount = await usersCollection.findOne({username: this.followedUsername})
    if(followedAccount){
        this.followedId = followedAccount._id
    }else{
        this.errors.push("You cannot follow a user that doesn't exist.")
    }

    let doesFollowAlreadyExist = await followedCollection.findOne({followedId: this.followedId, authorId: new ObjectID(this.authorId)})
    if(action == "create"){
        if(doesFollowAlreadyExist){this.errors.push("You are already following this user.")}
    }
    if(action == "delete"){
        if(!doesFollowAlreadyExist){this.errors.push("You cannot stop following someone you do not already follow.")}
    }
    // You should not be able to follow yourself
    if(this.followedId.equals(this.authorId)){this.errors.push("You cannot follow yourself.")}
}

Follow.prototype.create = function(){
    return new Promise(async (resolve, reject)=>{
        this.cleanUp()
        await this.validate("create")
        if(!this.errors.length){
            await followedCollection.insertOne({followedId: this.followedId, authorId: new ObjectID(this.authorId)})
            resolve()
        }else{
            reject(this.errors)
        }
    })
}
Follow.prototype.delete = function(){
    return new Promise(async (resolve, reject)=>{
        this.cleanUp()
        await this.validate("delete")
        if(!this.errors.length){
            await followedCollection.deleteOne({followedId: this.followedId, authorId: new ObjectID(this.authorId)})
            resolve()
        }else{
            reject(this.errors)
        }
    })
}

Follow.isVisitorFollowing = async function(followedId, visitorId){
    let followDoc = await followedCollection.findOne({followedId: followedId, authorId: new ObjectID(visitorId)})
    if(followDoc){
        return true
    }else{
        return false
    }
}

Follow.getFollowersById = function(id){
    return new Promise(async (resolve, reject)=> {
        try{
            let followers = await followedCollection.aggregate([
                {$match: {followedId: id}},
                {$lookup: {from: "users", localField: "authorId", foreignField:"_id", as: "userDoc"}},
                {$project: {
                    username: {$arrayElemAt: ["$userDoc.username", 0]},
                    email: {$arrayElemAt: ["$userDoc.email", 0]}
                }}
            ]).toArray()
            followers = followers.map(function(follower){
                // create a user
                let user = new User(follower, true)
                return {username: follower.username, avatar: user.avatar}
            })
            console.log(followers)
            resolve(followers)
        }catch{
            reject()
        }   
    })
}
Follow.getFollowingById = function(id){
    return new Promise(async (resolve, reject)=> {
        try{
            let followers = await followedCollection.aggregate([
                {$match: {authorId: id}},
                {$lookup: {from: "users", localField: "followedId", foreignField:"_id", as: "userDoc"}},
                {$project: {
                    username: {$arrayElemAt: ["$userDoc.username", 0]},
                    email: {$arrayElemAt: ["$userDoc.email", 0]}
                }}
            ]).toArray()
            followers = followers.map(function(follower){
                // create a user
                let user = new User(follower, true)
                return {username: follower.username, avatar: user.avatar}
            })
            console.log(followers)
            resolve(followers)
        }catch{
            reject()
        }   
    })
}

Follow.countFollowersById = function(id){
    return new Promise( async (resolve, reject)=>{
        let followerCount = await followedCollection.countDocuments({followedId: id})
        resolve(followerCount)
    })
}
Follow.countFollowingById = function(id){
    return new Promise( async (resolve, reject)=>{
        let count = await followedCollection.countDocuments({authorId: id})
        resolve(count)
    })
}
module.exports = Follow