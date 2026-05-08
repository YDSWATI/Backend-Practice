import { asyncHandler } from "../utils/asynhandler.js";
import {ApiError} from "../utils/APIErrors.js"
import { User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
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
        req.files?.coverImage[0]?.path;

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
    new ApiResponse(200,createdUser,"User registered Successfully")
   )


})
export {registerUser}