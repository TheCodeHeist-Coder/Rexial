# _______________________________________ISSUES______________________________________

## (1)First Issue

####  ```Race Condition```
#### -> Check the route in /apps/http-server/routes 
 ```bash
 /api/v1/quizzes/:quizId/generate-access-code
 ```

* In this route, we have to tackle race-condition while generating unique-access code for joining quiz.
* If two user say A & B. If they request at the same time and accidently get the same code...

* Request - A
  ```bash
  generateCode → AC123A
  ```

* Request - B
  ```bash
  generateCode → AC123A
  ```

 -> SO this may give some concurrency  issues.

#### ***Final Command***
 -> See the route   and analyze the prisma queries and try to optimise the code to stop these concurrency issues  


 ## (2)Second Issue (Functionality Add on)

  -> Backend route `/apps/http-server/routes/quiz.ts`

 #### -> Check the page in frontend `/apps/frontend/src/screens/QuizBuilder.tsx`
        * This is the page where we can create question 
        * But in this page after creating Questions there is no option of deleting Questions.
        * Therefore, you have to implement the functionalty of deleting the created questions

#### ***Final Command***
 -> See and use the page and after understanding the codebase, Implementing this Feature in frontend and backend both. 


 ## (3) Third Issue (Functionality Add on)

   -> Backend route `/apps/http-server/routes/quiz.ts`
  #### -> Check the page in frontend `/apps/frontend/src/screens/QuizBuilder.tsx`
        * This is the page where we can create question 
        * But in this page after creating Questions there is no option of editing or updating Questions.
        * Therefore, you have to implement the functionalty of updating the created questions

