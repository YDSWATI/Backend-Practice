import { asyncHandler } from "../utils/asynhandler.js";
import {ApiError} from "../utils/APIErrors.js"
import { User} from "../models/user.model.js"
import {uploadOnCloudinary,deleteFromCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshToken = async(userId)=>{
    try{

        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave : false});

        return {accessToken,refreshToken}

    }catch(error){
        throw new ApiError(500,error.message || "Something went wrong while generating tokens")
    }
}


const registerUser = asyncHandler(async (req,res) =>{
    //get user details from frontend
    //validation-not empty
    //check if user already ther
    //check for imgs ,avatar
    //upload on cloudinary
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    const {fullName,email,username,password} = req.body
    console.log("email: ",email)
    // if(fullname === ""){
    //     throw new ApiError(400,"Fullname is required")
    // }
    if (
        [fullName, email, username, password].some(
            (field) => field?.trim() === ""
        )
    ) {
        throw new ApiError(400, "All fields are required");
    }

    const existedUser = await User.findOne({
        $or:[{email}, {username}]
    }) 
    if(existedUser){
        throw new ApiError(409,"user with email or username already exist")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;

    const coverImageLocalPath =
        req.files?.coverImage?.[0]?.path;

   if(!avatarLocalPath){
    throw new ApiError(400,"avatar required");
   }
   const avatar = await uploadOnCloudinary(avatarLocalPath);
   const coverImage = await uploadOnCloudinary(coverImageLocalPath);
   if(!avatar){
    throw new ApiError(400,"avatar required");
   }


   //database entry
   const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage : coverImage?.url||"",
    email,
    password,
    username: username.toLowerCase()
   })
   const createdUser=await User.findById(user._id).select(
    "-password -refreshToken"
   )

   if(!createdUser){
    throw new ApiError(500,"Something went wrong while registering the user")
   }

   return res.status(201).json(
    new ApiResponse(201,createdUser,"User registered Successfully")
   )


})

const loginUser = asyncHandler(async (req,res)=>{
    //req body ->data
    //username or email ther?
    //find the user
    //password check
    //access and refresh token genertae
    //send cookie
    const {email,username,password} = req.body
    console.log(email);
    if(!username && !email ) {
        throw new ApiError(400,"username or email is reguired")

    }
    const user = await User.findOne({
        $or:[{email}, {username}]
    }) 

    if(!user){
        throw new ApiError(404,"user doesnt exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401,"Invalid user credentials")
    }
    const {accessToken,refreshToken}=await generateAccessAndRefreshToken(user._id);

   const loggedinUser =await User.findById(user._id).select("-password -refreshToken")

   const options = {
    httpOnly:true,
    secure:true
   }
   return res
   .status(200)
   .cookie("accessToken",accessToken,options)
   .cookie("refreshToken",refreshToken,options)
   .json(
        new ApiResponse(
            200,{
                user:loggedinUser,accessToken,refreshToken
            },
            "User logged in successfully"
        )
   )

})

const logoutUser = asyncHandler(async (req, res) => {

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    );

    const options = {
        httpOnly: true,
        secure: true
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(200, {}, "User logged out")
        );
});


const refreshAccessToken = asyncHandler(async(req,res)=>{
    try {
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
        if(!incomingRefreshToken){
            throw new ApiError(401,"Unauthorized request")
        }
    
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET,
        )
        const user = await User.findById(decodedToken?._id)
        if(!user){
            throw new ApiError(401,"invalid refresh token")
        }
    
        if(incomingRefreshToken!==user?.refreshToken){
            throw new ApiError(401,"refresh token is expired or used")
        }
    
        const options = {
            httpOnly:true,
            secure:true,
        }
        const {accessToken,refreshToken}=await generateAccessAndRefreshToken(user._id)
        return res.status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",refreshToken,options)
        .json(
            new ApiResponse(
                200,
                {accessToken,refreshToken:refreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {

        throw new ApiError(401,error?.message || "Invalid refresh token")
        
    }
})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword, newPassword} = req.body;
    const user =  await User.findById(req.user?._id)
    const isPasswordCorrect= await user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid old Password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave:false});
    return res.status(200)
    .json(new ApiResponse(200,{},"Password changed Successfully"))
})


const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse(200,req.user,"current user fetched successfully"))
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullName,email} = req.body
    if(!fullName || !email){
        throw new ApiError(400,"All fields are required")
    }

    const user =await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName,
                email,

            }
        },{
            new:true
        }
    ).select("-password")
    return res
    .status(200)
    .json(new ApiResponse(200,user,"Accounts details updated successfully"))
})

const updateUserAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPath= req.file?.path
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar is missing")
    }

    //grab the old user
    const oldUser = await User.findById(req.user?._id).select("avatar");
    const oldAvatarUrl = oldUser?.avatar;

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400,"error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
    {
        $set:{
            avatar:avatar.url
        },
        
    },{new:true}).select("-password")

    await deleteFromCloudinary(oldAvatarUrl);

    return res
    .status(200)
    .json(
        new ApiResponse(200,user,"cover Image updated successfully")
    )
})
const updateUserCoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath= req.file?.path
    if(!coverImageLocalPath){
        throw new ApiError(400,"Cover image is missing")
    }

    // 1. Grab the old URL before overwriting
    const oldUser = await User.findById(req.user?._id).select("coverImage");
    const oldCoverUrl = oldUser?.coverImage;


    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400,"error while uploading on coverImage")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
    {
        $set:{
            coverImage:coverImage.url
        },
        
    },{new:true}).select("-password")

     // 4. Delete old image from Cloudinary (after DB is updated safely)
     await deleteFromCloudinary(oldCoverUrl);

    return res
    .status(200)
    .json(
        new ApiResponse(200,user,"cover Image updated successfully")
    )
})


const getUserChannelProfile=asyncHandler(async(req,res)=>{

    const {username} =  req.params
    if(!username?.trim()){
        throw new ApiError(400,"username is missing")
    }

    const channel = await User.aggregate([
        {
            $match:{
                username:username?.toLowerCase()
            }
        },{
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        },{
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }

        },{
            $addFields:{
                subscribersCount:{
                    $size:"subscribers"
                },
                channelsSubscibedToCount:{
                    $size:"subscribedTo"
                },
                isSubscibed:{
                    $cond:{
                        if:{
                            $in:[req.user?._id,"subscribers.subscriber"]
                        },
                        then:true,
                        else:false
                    }
                }
                
            }
        },{
            $project:{
                fullName:1,
                username:1,
                subscribersCount:1,
                channelsSubscibedToCount:1,
                isSubscibed:1,
                avatar:1,
                coverImage:1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404,"channel doesnt exist")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,channel[0],"User Channel fetched successfully")
    )
})
export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,


}