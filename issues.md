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